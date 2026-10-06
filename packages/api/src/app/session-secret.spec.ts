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

  it('throws when the secret is not an array', () => {
    expect(() => assertValidSessionSecret('a-real-secret')).toThrow('SESSION_SECRET must be configured');
  });

  it('throws when the secret array is empty', () => {
    expect(() => assertValidSessionSecret([])).toThrow('SESSION_SECRET must be configured');
  });

  it('throws when the secret still equals the old hardcoded default', () => {
    expect(() => assertValidSessionSecret(['my-secret'])).toThrow(
      'SESSION_SECRET must be configured to a value other than the committed placeholder'
    );
  });

  it('throws when the secret still equals the compose/.env.example placeholder', () => {
    expect(() => assertValidSessionSecret(['change-me-generate-with-openssl-rand'])).toThrow(
      'SESSION_SECRET must be configured to a value other than the committed placeholder'
    );
  });

  it('throws when a known placeholder is present alongside a real secret', () => {
    expect(() => assertValidSessionSecret(['real-secret', 'my-secret'])).toThrow(
      'SESSION_SECRET must be configured to a value other than the committed placeholder'
    );
  });

  it('throws when the signing entry is a blank string', () => {
    expect(() => assertValidSessionSecret([''])).toThrow('SESSION_SECRET entries must all be non-blank strings');
  });

  it('throws when a verification-only rotation entry is a blank string', () => {
    expect(() => assertValidSessionSecret(['current-secret', ''])).toThrow(
      'SESSION_SECRET entries must all be non-blank strings'
    );
  });

  it('throws when an entry is whitespace-only', () => {
    expect(() => assertValidSessionSecret(['   '])).toThrow('SESSION_SECRET entries must all be non-blank strings');
  });

  it('throws when an entry is null', () => {
    expect(() => assertValidSessionSecret([null])).toThrow('SESSION_SECRET entries must all be non-blank strings');
  });

  it('throws when an entry is not a string', () => {
    expect(() => assertValidSessionSecret([42])).toThrow('SESSION_SECRET entries must all be non-blank strings');
  });
});
