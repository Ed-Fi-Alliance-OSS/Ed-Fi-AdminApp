const DEFAULT_SESSION_SECRET = 'my-secret';

/**
 * Throws if the session secret is missing or still equal to the old hardcoded
 * default, so a misconfigured deployment fails to start instead of silently
 * signing session cookies with a known, shared secret.
 */
export function assertValidSessionSecret(sessionSecret: string[] | undefined): asserts sessionSecret is string[] {
  if (!sessionSecret || sessionSecret.length === 0 || sessionSecret.includes(DEFAULT_SESSION_SECRET)) {
    throw new Error('SESSION_SECRET must be configured');
  }
}
