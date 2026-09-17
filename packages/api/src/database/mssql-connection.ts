import * as config from 'config';
import * as sql from 'mssql';
// Imported from its own module rather than the '../utils' barrel, which re-exports
// customExceptions and so pulls @nestjs/common into anything importing it. This module
// needs none of that. checkEnv.ts imports asBool the same way.
import { asBool } from '../utils/config-bool';

/** Default connect timeout for API-owned MSSQL connections. */
export const MSSQL_DEFAULT_CONNECTION_TIMEOUT_MS = 5000;

/** The SQL Server service name used by the bundled Docker Compose stack. */
const COMPOSE_MSSQL_SERVICE = 'edfiadminapp-mssql';

/** The Docker volume backing that service, as named in compose/adminapp-services.yml. */
const COMPOSE_MSSQL_VOLUME = 'vol-edfiadminapp-mssql';

export interface CreateMssqlConfigOptions {
  /** Overrides MSSQL_DEFAULT_CONNECTION_TIMEOUT_MS -- the health check needs a shorter budget. */
  connectionTimeout?: number;
}

/**
 * Builds an mssql driver config from DB_CONNECTION_STRING. This is the single source of truth
 * for how the API's own startup check and health check interpret the connection string.
 *
 * Note it is NOT the only place TLS options are derived: typeorm.config.ts and
 * database-config.service.ts build their own `encrypt`/`trustServerCertificate` pair for the
 * runtime pool. Keep the three in step until they are consolidated.
 */
export async function createMssqlConfig(
  options: CreateMssqlConfigOptions = {}
): Promise<sql.config> {
  const connectionString = await config.DB_CONNECTION_STRING;
  const urlParts = new URL(connectionString);

  return {
    server: urlParts.hostname,
    port: parseInt(urlParts.port) || 1433,
    // WHATWG URL hands back userinfo and the path still percent-encoded, so decode before
    // giving them to the driver. config/default.js encodes them when building the string;
    // the two must stay in step, or a password containing '@' or '#' silently becomes the
    // wrong credential and fails as an indistinguishable "Login failed".
    database: decodeURIComponent(urlParts.pathname.slice(1)),
    user: decodeURIComponent(urlParts.username),
    password: decodeURIComponent(urlParts.password),
    options: {
      encrypt: asBool(config.DB_SSL),
      trustServerCertificate: asBool(config.DB_TRUST_CERTIFICATE),
    },
    connectionTimeout: options.connectionTimeout ?? MSSQL_DEFAULT_CONNECTION_TIMEOUT_MS,
  };
}

/** What the probe learned, so callers do not have to re-parse the connection string. */
export interface UnreachableDatabase {
  databaseName: string;
  server: string;
  user: string;
}

/**
 * Probes whether the configured database is absent, after a connection failure.
 *
 * Deliberately a positive probe rather than error matching. SQL Server raises error 4060
 * ("Cannot open database ... requested by the login") for this case, but the mssql/tedious
 * driver collapses it into a generic ELOGIN ConnectionError carrying no error number on any
 * property -- shape-identical to a wrong password. Verified against SQL Server 2022 CU26:
 * connecting to a non-existent database yields only `code: 'ELOGIN'` and the message
 * "Login failed for user 'sa'.", so there is nothing reliable to match on.
 *
 * Instead, reconnect to `master` with the same credentials and ask for the database's id.
 * If master accepts the login, the credentials are valid, and a NULL id means the database is
 * not visible to this login -- either absent, or hidden because the login lacks VIEW ANY
 * DATABASE. Callers must phrase the result to allow both; see describeMissingDatabase.
 *
 * Returns null whenever it cannot prove the claim, so a caller never reports a missing
 * database on a guess.
 */
export async function findMissingDatabase(): Promise<UnreachableDatabase | null> {
  let target: sql.config;

  try {
    target = await createMssqlConfig();
  } catch {
    return null;
  }

  const databaseName = target.database ?? '';
  // Nothing to diagnose: master always exists, and an empty name is a config problem.
  if (!databaseName || databaseName === 'master') {
    return null;
  }

  const pool = new sql.ConnectionPool({ ...target, database: 'master' });
  try {
    await pool.connect();
    const result = await pool
      .request()
      .input('databaseName', sql.NVarChar, databaseName)
      .query('SELECT DB_ID(@databaseName) AS id');

    if (result.recordset[0]?.id !== null) {
      return null;
    }

    return { databaseName, server: target.server ?? '', user: target.user ?? '' };
  } catch {
    // Could not reach master either -- the failure is something else entirely.
    return null;
  } finally {
    try {
      await pool.close();
    } catch {
      // Ignore cleanup failures; the caller is already on an error path.
    }
  }
}

/**
 * Builds the operator-facing explanation for a database the API cannot open.
 *
 * Pure and exported so it can be tested without a SQL Server. The container-specific
 * remedies are only offered when the server is the bundled Compose service -- telling an
 * operator on a managed or remote instance to `docker volume rm` would be wrong, and
 * destructive if followed.
 */
export function describeMissingDatabase(target: UnreachableDatabase): string[] {
  const { databaseName, server, user } = target;

  const lines = [
    `SQL Server at "${server}" is reachable and the credentials are valid, but the database "${databaseName}" is not available to login "${user}".`,
    'Either it does not exist, or this login lacks permission to see it (VIEW ANY DATABASE).',
  ];

  if (server !== COMPOSE_MSSQL_SERVICE) {
    lines.push(
      `If it does not exist, create it and restart the API -- migrations run automatically: CREATE DATABASE [${databaseName}]`
    );
    return lines;
  }

  lines.push(
    'The SQL Server container only creates the database named by MSSQL_DB in compose/.env on first boot,',
    'while /var/opt/mssql/data is still empty. On a volume left over from an earlier run it logs',
    '"data directory is not empty, ignoring" and creates nothing.',
    'Choose one of the following -- the API will not do this for you, and option 2 destroys data:',
    '  1. Create the database, keeping existing data:',
    `     docker exec ${COMPOSE_MSSQL_SERVICE} /bin/bash -c '/opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -Q "CREATE DATABASE [${databaseName}]"'`,
    `  2. Re-initialize SQL Server from scratch. THIS DESTROYS ALL ADMIN APP DATA in ${COMPOSE_MSSQL_VOLUME}:`,
    `     cd compose && ./stop.ps1 && docker volume rm ${COMPOSE_MSSQL_VOLUME} && ./start-services.ps1 -MSSQL`
  );

  return lines;
}
