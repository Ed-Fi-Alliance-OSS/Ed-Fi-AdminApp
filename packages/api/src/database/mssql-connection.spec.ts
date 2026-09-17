import 'reflect-metadata';
import * as sql from 'mssql';
import {
  createMssqlConfig,
  describeMissingDatabase,
  findMissingDatabase,
  MSSQL_DEFAULT_CONNECTION_TIMEOUT_MS,
} from './mssql-connection';

// Replace only ConnectionPool so findMissingDatabase never opens a socket; everything else
// (sql.NVarChar, types) comes from the real module.
jest.mock('mssql', () => ({
  ...jest.requireActual('mssql'),
  ConnectionPool: jest.fn(),
}));

const ConnectionPoolMock = sql.ConnectionPool as unknown as jest.Mock;

// jest.config.ts maps 'config' to src/test/config.mock.ts, which uses `export = config`.
// `import * as config` would give an __importStar namespace whose properties are getter-only
// and therefore unassignable; requireActual returns the underlying mutable object instead.
const mutableConfig = jest.requireActual('config') as unknown as Record<string, unknown>;

/** Installs a fake pool. `id` is what SELECT DB_ID(...) returns; undefined means empty recordset. */
function givenMasterReturns(id: number | null | undefined) {
  const request = {
    input: jest.fn().mockReturnThis(),
    query: jest.fn().mockResolvedValue({ recordset: id === undefined ? [] : [{ id }] }),
  };
  const pool = {
    connect: jest.fn().mockResolvedValue(undefined),
    request: jest.fn(() => request),
    close: jest.fn().mockResolvedValue(undefined),
  };
  ConnectionPoolMock.mockImplementation(() => pool);
  return { pool, request };
}

function givenMasterUnreachable() {
  const pool = {
    connect: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    request: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };
  ConnectionPoolMock.mockImplementation(() => pool);
  return pool;
}

describe('createMssqlConfig', () => {
  const originalConnectionString = mutableConfig.DB_CONNECTION_STRING;
  const originalSsl = mutableConfig.DB_SSL;
  const originalTrust = mutableConfig.DB_TRUST_CERTIFICATE;

  beforeEach(() => {
    mutableConfig.DB_CONNECTION_STRING = 'mssql://sa:pw@edfiadminapp-mssql:1433/sbaa';
    mutableConfig.DB_SSL = false;
    mutableConfig.DB_TRUST_CERTIFICATE = false;
  });

  afterEach(() => {
    mutableConfig.DB_CONNECTION_STRING = originalConnectionString;
    mutableConfig.DB_SSL = originalSsl;
    mutableConfig.DB_TRUST_CERTIFICATE = originalTrust;
  });

  it('maps every part of the connection string onto the driver config', async () => {
    const result = await createMssqlConfig();
    expect(result.server).toBe('edfiadminapp-mssql');
    expect(result.port).toBe(1433);
    expect(result.database).toBe('sbaa');
    expect(result.user).toBe('sa');
    expect(result.password).toBe('pw');
  });

  it('defaults the port to 1433 when the connection string omits it', async () => {
    mutableConfig.DB_CONNECTION_STRING = 'mssql://sa:pw@edfiadminapp-mssql/sbaa';
    const result = await createMssqlConfig();
    expect(result.port).toBe(1433);
  });

  it('uses the shared default connection timeout', async () => {
    const result = await createMssqlConfig();
    expect(result.connectionTimeout).toBe(MSSQL_DEFAULT_CONNECTION_TIMEOUT_MS);
  });

  it('honours a caller-supplied connection timeout', async () => {
    const result = await createMssqlConfig({ connectionTimeout: 2000 });
    expect(result.connectionTimeout).toBe(2000);
  });

  it('enables encryption and certificate trust when configured as the string "true"', async () => {
    mutableConfig.DB_SSL = 'true';
    mutableConfig.DB_TRUST_CERTIFICATE = 'true';
    const result = await createMssqlConfig();
    expect(result.options?.encrypt).toBe(true);
    expect(result.options?.trustServerCertificate).toBe(true);
  });

  it('treats any other string as false', async () => {
    mutableConfig.DB_SSL = 'no';
    const result = await createMssqlConfig();
    expect(result.options?.encrypt).toBe(false);
  });
});

describe('findMissingDatabase', () => {
  const originalConnectionString = mutableConfig.DB_CONNECTION_STRING;

  beforeEach(() => {
    mutableConfig.DB_CONNECTION_STRING = 'mssql://sa:pw@edfiadminapp-mssql:1433/sbaa';
    ConnectionPoolMock.mockReset();
  });

  afterEach(() => {
    mutableConfig.DB_CONNECTION_STRING = originalConnectionString;
  });

  it('reports the database when master says its id is NULL', async () => {
    givenMasterReturns(null);

    await expect(findMissingDatabase()).resolves.toEqual({
      databaseName: 'sbaa',
      server: 'edfiadminapp-mssql',
      user: 'sa',
    });
  });

  it('queries master for the configured database, not the configured database itself', async () => {
    const { request } = givenMasterReturns(null);

    await findMissingDatabase();

    expect(ConnectionPoolMock).toHaveBeenCalledWith(
      expect.objectContaining({ database: 'master', server: 'edfiadminapp-mssql' })
    );
    expect(request.input).toHaveBeenCalledWith('databaseName', expect.anything(), 'sbaa');
    expect(request.query).toHaveBeenCalledWith('SELECT DB_ID(@databaseName) AS id');
  });

  it('returns null when the database exists', async () => {
    givenMasterReturns(5);
    await expect(findMissingDatabase()).resolves.toBeNull();
  });

  // Guards against `?.id === null` being loosened to a falsy check: an empty recordset yields
  // undefined, which means "unknown", not "missing".
  it('returns null when master returns no row at all', async () => {
    givenMasterReturns(undefined);
    await expect(findMissingDatabase()).resolves.toBeNull();
  });

  it('returns null when master itself is unreachable', async () => {
    givenMasterUnreachable();
    await expect(findMissingDatabase()).resolves.toBeNull();
  });

  it('closes the pool even when the query path fails', async () => {
    const pool = givenMasterUnreachable();
    await findMissingDatabase();
    expect(pool.close).toHaveBeenCalled();
  });

  // The guard clauses must short-circuit before any connection is attempted. Asserting only
  // the null return would not prove that -- null is also the universal failure result.
  it.each([
    ['master', 'mssql://sa:pw@edfiadminapp-mssql:1433/master'],
    ['no database name', 'mssql://sa:pw@edfiadminapp-mssql:1433/'],
    ['an unparseable connection string', 'not a url'],
  ])('returns null without connecting when given %s', async (_label, connectionString) => {
    mutableConfig.DB_CONNECTION_STRING = connectionString;

    await expect(findMissingDatabase()).resolves.toBeNull();
    expect(ConnectionPoolMock).not.toHaveBeenCalled();
  });
});

describe('describeMissingDatabase', () => {
  const compose = { databaseName: 'sbaa', server: 'edfiadminapp-mssql', user: 'sa' };
  const external = { databaseName: 'sbaa', server: 'sql.example.org', user: 'adminapp' };

  it('names the database, the server and the login', () => {
    const text = describeMissingDatabase(compose).join('\n');
    expect(text).toContain('"sbaa"');
    expect(text).toContain('edfiadminapp-mssql');
    expect(text).toContain('"sa"');
  });

  // The probe cannot distinguish absent from invisible, so the message must not claim it can.
  it('allows for the database existing but being invisible to the login', () => {
    const text = describeMissingDatabase(compose).join('\n');
    expect(text).toContain('VIEW ANY DATABASE');
  });

  it('offers the container remedies only for the bundled Compose service', () => {
    const text = describeMissingDatabase(compose).join('\n');
    expect(text).toContain('docker exec edfiadminapp-mssql');
    expect(text).toContain('vol-edfiadminapp-mssql');
  });

  // docker exec runs the binary directly with no shell in the container, so the variable has
  // to be expanded by a shell we start ourselves -- otherwise the host shell expands it to
  // nothing and the operator gets "Login failed", which looks like a wrong password.
  it('expands the password inside the container rather than in the operator shell', () => {
    const text = describeMissingDatabase(compose).join('\n');
    expect(text).toContain(`/bin/bash -c '/opt/mssql-tools18/bin/sqlcmd`);
    expect(text).toContain('-P "$MSSQL_SA_PASSWORD"');
  });

  it('never suggests docker or volume removal for a server outside the Compose stack', () => {
    const text = describeMissingDatabase(external).join('\n');
    expect(text).not.toContain('docker');
    expect(text).not.toContain('volume rm');
    expect(text).toContain('CREATE DATABASE [sbaa]');
  });

  it('warns that the re-initialize remedy destroys data', () => {
    const text = describeMissingDatabase(compose).join('\n');
    expect(text).toContain('DESTROYS ALL ADMIN APP DATA');
  });
});
