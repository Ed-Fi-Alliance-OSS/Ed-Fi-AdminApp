// Values committed or documented in this repo as samples. They are publicly known and are never
// valid in a real production deployment.
export const KNOWN_SAMPLE_SECRETS: readonly string[] = ['postgres', 'YourStrong!Passw0rd', 'big-secret-123'];

const PLACEHOLDER_PATTERN = /^(<set-me>|change-me)/i;

export interface ProductionSecretsInput {
  nodeEnv: string | undefined;
  dbEngine: 'pgsql' | 'mssql';
  /**
   * Locally configured DB secret. Pass `undefined` when the DB secret comes from AWS Secrets
   * Manager: those values are operator-managed and are not inspected here.
   */
  dbSecret?: { DB_PASSWORD?: unknown; MSSQL_DB_PASSWORD?: unknown };
  /**
   * Only checked when provided. Without a client secret the first-run OIDC seeding is skipped,
   * so there is nothing to validate.
   */
  sampleOidcClientSecret?: unknown;
}

function describeProblem(name: string, value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return `${name} is missing or blank`;
  }
  if (PLACEHOLDER_PATTERN.test(value) || KNOWN_SAMPLE_SECRETS.includes(value)) {
    return `${name} is still a placeholder or known sample value`;
  }
  return undefined;
}

/**
 * Throws, listing every offending variable, when a production deployment would start with a
 * missing, placeholder or publicly known secret. Does nothing outside NODE_ENV=production so
 * local development with sample values keeps working. The encryption key is validated
 * separately by assertValidDbEncryptionSecret.
 */
export function assertProductionSecrets(input: ProductionSecretsInput): void {
  if (input.nodeEnv !== 'production') {
    return;
  }

  const problems: string[] = [];

  if (input.dbSecret) {
    const field = input.dbEngine === 'mssql' ? 'MSSQL_DB_PASSWORD' : 'DB_PASSWORD';
    const problem = describeProblem(`DB_SECRET_VALUE.${field}`, input.dbSecret[field]);
    if (problem) {
      problems.push(problem);
    }
  }

  if (input.sampleOidcClientSecret !== undefined) {
    const problem = describeProblem('SAMPLE_OIDC_CONFIG.clientSecret', input.sampleOidcClientSecret);
    if (problem) {
      problems.push(problem);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start: insecure production configuration.\n${problems
        .map((p) => `  - ${p}. Set a real value via environment variable or AWS Secrets Manager.`)
        .join('\n')}`
    );
  }
}
