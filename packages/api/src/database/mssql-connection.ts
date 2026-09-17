import * as config from 'config';
import * as sql from 'mssql';
// Imported from its own module rather than the '../utils' barrel, which re-exports
// customExceptions and so pulls @nestjs/common into anything importing it. This module
// needs none of that. checkEnv.ts imports asBool the same way.
import { asBool } from '../utils/config-bool';

/** Default connect timeout for API-owned MSSQL connections. */
export const MSSQL_DEFAULT_CONNECTION_TIMEOUT_MS = 5000;

export interface CreateMssqlConfigOptions {
  /** Overrides MSSQL_DEFAULT_CONNECTION_TIMEOUT_MS -- the health check needs a shorter budget. */
  connectionTimeout?: number;
}

/**
 * Builds an mssql driver config from DB_CONNECTION_STRING. Single source of truth: the API
 * startup check and the health check must agree on how the connection string is interpreted.
 */
export async function createMssqlConfig(
  options: CreateMssqlConfigOptions = {}
): Promise<sql.config> {
  const connectionString = await config.DB_CONNECTION_STRING;
  const urlParts = new URL(connectionString);

  return {
    server: urlParts.hostname,
    port: parseInt(urlParts.port) || 1433,
    database: urlParts.pathname.slice(1),
    user: urlParts.username,
    password: urlParts.password,
    options: {
      encrypt: asBool(config.DB_SSL),
      trustServerCertificate: asBool(config.DB_TRUST_CERTIFICATE),
    },
    connectionTimeout: options.connectionTimeout ?? MSSQL_DEFAULT_CONNECTION_TIMEOUT_MS,
  };
}

/**
 * Answers "is the configured database absent?" after a connection failure.
 *
 * Deliberately a positive probe rather than error matching. SQL Server raises error 4060
 * ("Cannot open database ... requested by the login") for this case, but the mssql/tedious
 * driver collapses it into a generic ELOGIN ConnectionError carrying no error number on any
 * property -- shape-identical to a wrong password. Verified against SQL Server 2022 CU26:
 * connecting to a non-existent database yields only `code: 'ELOGIN'` and the message
 * "Login failed for user 'sa'.", so there is nothing reliable to match on.
 *
 * Instead, reconnect to `master` with the same credentials and ask for the database's id.
 * If master accepts the login, the credentials are valid, and a NULL id proves the target
 * database really is missing. Read-only, and returns false whenever it cannot prove the
 * claim, so a caller never reports a missing database on a guess.
 */
export async function isConfiguredDatabaseMissing(): Promise<boolean> {
  let databaseName: string;
  let masterConfig: sql.config;

  try {
    const target = await createMssqlConfig();
    databaseName = target.database ?? '';
    // Nothing to diagnose: master always exists, and an empty name is a config problem.
    if (!databaseName || databaseName === 'master') {
      return false;
    }
    masterConfig = { ...target, database: 'master' };
  } catch {
    return false;
  }

  const pool = new sql.ConnectionPool(masterConfig);
  try {
    await pool.connect();
    const result = await pool
      .request()
      .input('databaseName', sql.NVarChar, databaseName)
      .query('SELECT DB_ID(@databaseName) AS id');
    return result.recordset[0]?.id === null;
  } catch {
    // Could not reach master either -- the failure is something else entirely.
    return false;
  } finally {
    try {
      await pool.close();
    } catch {
      // Ignore cleanup failures; the caller is already on an error path.
    }
  }
}
