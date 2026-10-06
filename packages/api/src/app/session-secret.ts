// Values that are committed or documented in this repo as placeholders, never
// valid in a real deployment: the old hardcoded middleware secret, and the
// compose/.env.example sample value.
const KNOWN_PLACEHOLDER_SECRETS = ['my-secret', 'change-me-generate-with-openssl-rand'];

/**
 * Throws if the session secret is missing, contains a blank/non-string entry,
 * or still equals a known placeholder value, so a misconfigured deployment
 * fails to start instead of silently signing session cookies with a known or
 * otherwise unusable secret.
 */
export function assertValidSessionSecret(sessionSecret: unknown): asserts sessionSecret is string[] {
  if (!Array.isArray(sessionSecret) || sessionSecret.length === 0) {
    throw new Error('SESSION_SECRET must be configured');
  }

  for (const secret of sessionSecret) {
    if (typeof secret !== 'string' || secret.trim().length === 0) {
      throw new Error('SESSION_SECRET entries must all be non-blank strings');
    }
    if (KNOWN_PLACEHOLDER_SECRETS.includes(secret)) {
      throw new Error('SESSION_SECRET must be configured to a value other than the committed placeholder');
    }
  }
}
