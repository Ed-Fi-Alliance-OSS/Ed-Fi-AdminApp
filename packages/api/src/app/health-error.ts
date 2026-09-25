import { AggregateErrorHandler } from './aggregate-error-handler';

// Disclosure allowlist for logs and public responses, not the broader message/code classification in
// AggregateErrorHandler.isDatabaseConnectionError/isConnectionError. Review both when adding codes.
const DIAGNOSTIC_CODES: ReadonlyMap<string, string> = new Map([
  ['ECONNREFUSED', 'Connection refused'],
  ['ECONNRESET', 'Connection reset by peer'],
  ['ETIMEDOUT', 'Network operation timed out'],
  ['EPIPE', 'Attempted write to a closed connection'],
  ['ELOGIN', 'Database login failed'],
  ['ETIMEOUT', 'Database operation timed out'],
  ['ESOCKET', 'Database socket error'],
  ['ENOTOPEN', 'Database connection is not open'],
  ['28P01', 'Password authentication failed'],
  ['3D000', 'Invalid database/catalog name'],
  ['53300', 'Too many database connections'],
  ['57P01', 'Connection terminated by administrative shutdown'],
  ['57P03', 'Database cannot accept connections now'],
  ['08000', 'Database connection exception'],
  ['08003', 'Database connection does not exist'],
  ['08006', 'Database connection failure'],
]);

interface HealthErrorDiagnostic {
  kind: string;
  code?: string;
  description?: string;
  errorCount?: number;
}

function classifyHealthError(error: unknown): HealthErrorDiagnostic {
  try {
    const aggregate = AggregateErrorHandler.isAggregateError(error);
    const kind = aggregate
      ? 'AggregateError'
      : error instanceof Error
        ? 'Error'
        : error === null
          ? 'null'
          : typeof error;
    // Inspect only an own data property; reading error.code could invoke a driver-supplied getter.
    const candidate: unknown =
      typeof error === 'object' && error !== null
        ? Object.getOwnPropertyDescriptor(error, 'code')?.value
        : undefined;
    const code =
      typeof candidate === 'string' && DIAGNOSTIC_CODES.has(candidate) ? candidate : undefined;
    const description = code === undefined ? undefined : DIAGNOSTIC_CODES.get(code);
    const errorCount = aggregate ? error.errors.length : undefined;
    return { kind, code, description, errorCount };
  } catch {
    // Getters and Proxy traps can throw even during classification or descriptor lookup.
    return { kind: 'UninspectableError' };
  }
}

export function describeHealthError(error: unknown): string {
  return JSON.stringify(classifyHealthError(error));
}

export function getHealthFailureMessage(error: unknown): string {
  return `Health check failed: ${classifyHealthError(error).description ?? 'Unknown error'}`;
}
