import 'reflect-metadata';
import {
  createMssqlConfig,
  isConfiguredDatabaseMissing,
  MSSQL_DEFAULT_CONNECTION_TIMEOUT_MS,
} from './mssql-connection';

// jest.config.ts maps 'config' to src/test/config.mock.ts, which uses `export = config`.
// `import * as config` would give an __importStar namespace whose properties are getter-only
// and therefore unassignable; requireActual returns the underlying mutable object instead.
const mutableConfig = jest.requireActual('config') as unknown as Record<string, unknown>;

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

  it('coerces the string "true" for DB_SSL and DB_TRUST_CERTIFICATE via asBool', async () => {
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

describe('isConfiguredDatabaseMissing', () => {
  const originalConnectionString = mutableConfig.DB_CONNECTION_STRING;

  afterEach(() => {
    mutableConfig.DB_CONNECTION_STRING = originalConnectionString;
  });

  // Guard clauses -- these must never open a connection at all.
  it('returns false when the configured database is master', async () => {
    mutableConfig.DB_CONNECTION_STRING = 'mssql://sa:pw@edfiadminapp-mssql:1433/master';
    await expect(isConfiguredDatabaseMissing()).resolves.toBe(false);
  });

  it('returns false when the connection string names no database', async () => {
    mutableConfig.DB_CONNECTION_STRING = 'mssql://sa:pw@edfiadminapp-mssql:1433/';
    await expect(isConfiguredDatabaseMissing()).resolves.toBe(false);
  });

  it('returns false when the connection string cannot be parsed', async () => {
    mutableConfig.DB_CONNECTION_STRING = 'not a url';
    await expect(isConfiguredDatabaseMissing()).resolves.toBe(false);
  });

  // It must never claim a database is missing when it could not prove it. An unreachable
  // master fails, and that failure must read as "unknown", not "missing".
  // Port 1 on loopback is refused immediately and needs no DNS lookup, so this stays fast and
  // deterministic even when the full suite runs in parallel.
  it('returns false when master itself is unreachable', async () => {
    mutableConfig.DB_CONNECTION_STRING = 'mssql://sa:pw@127.0.0.1:1/sbaa';
    await expect(isConfiguredDatabaseMissing()).resolves.toBe(false);
  });
});
