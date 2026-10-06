// Environment variables that config/custom-environment-variables.js maps with `__format: 'json'`.
// node-config rethrows JSON parse failures with the JSON.parse message, which on Node 24 includes
// an excerpt of the input and would leak secret text into the logs. Checking them first lets us
// fail with a redacted message instead.
export const JSON_ENV_VARS: readonly string[] = [
  'DB_SECRET_VALUE',
  'DB_ENCRYPTION_SECRET_VALUE',
  'SESSION_SECRET_VALUE',
  'SAMPLE_OIDC_CONFIG',
  'AUTH0_CONFIG_SECRET_VALUE',
];

export function assertJsonEnvVarsParse(env: NodeJS.ProcessEnv = process.env): void {
  for (const name of JSON_ENV_VARS) {
    const value = env[name];
    if (typeof value !== 'string' || value.length === 0) {
      continue;
    }
    try {
      JSON.parse(value);
    } catch {
      // Deliberately do not include or chain the original error: it can contain the value.
      throw new Error(
        `${name} is not valid JSON. The value is not shown here to avoid logging secrets; check quoting and escaping.`
      );
    }
  }
}
