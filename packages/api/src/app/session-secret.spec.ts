import { assertValidSessionSecret } from './session-secret';

describe('assertValidSessionSecret', () => {
  it('accepts a configured secret array', () => {
    expect(() => assertValidSessionSecret(['a-real-secret'])).not.toThrow();
  });

  it('accepts multiple secrets to support rotation', () => {
    expect(() => assertValidSessionSecret(['new-secret', 'old-secret'])).not.toThrow();
  });

  it('throws when the secret is undefined', () => {
    expect(() => assertValidSessionSecret(undefined)).toThrow('SESSION_SECRET must be configured');
  });

  it('throws when the secret array is empty', () => {
    expect(() => assertValidSessionSecret([])).toThrow('SESSION_SECRET must be configured');
  });

  it('throws when the secret still equals the old hardcoded default', () => {
    expect(() => assertValidSessionSecret(['my-secret'])).toThrow('SESSION_SECRET must be configured');
  });

  it('throws when the default is present alongside a real secret', () => {
    expect(() => assertValidSessionSecret(['real-secret', 'my-secret'])).toThrow(
      'SESSION_SECRET must be configured'
    );
  });
});
