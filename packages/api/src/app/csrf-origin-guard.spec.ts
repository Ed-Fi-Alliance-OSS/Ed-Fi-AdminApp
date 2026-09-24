import { shouldBlockCrossSiteMutation } from './csrf-origin-guard';

describe('shouldBlockCrossSiteMutation', () => {
  const allowedOrigin = 'https://admin.example.org';

  it('does not block idempotent requests', () => {
    expect(shouldBlockCrossSiteMutation('GET', 'https://evil.example.org', 'cross-site', allowedOrigin)).toBe(
      false
    );
  });

  it('blocks non-idempotent requests when sec-fetch-site is cross-site', () => {
    expect(
      shouldBlockCrossSiteMutation('POST', 'https://admin.example.org', 'cross-site', allowedOrigin)
    ).toBe(true);
  });

  it('blocks non-idempotent requests when origin does not match allowed origin', () => {
    expect(
      shouldBlockCrossSiteMutation('PATCH', 'https://evil.example.org', 'same-site', allowedOrigin)
    ).toBe(true);
  });

  it('does not block non-idempotent requests when origin matches allowed origin', () => {
    expect(
      shouldBlockCrossSiteMutation('DELETE', 'https://admin.example.org/', 'same-origin', allowedOrigin)
    ).toBe(false);
  });

  it('does not block non-idempotent requests without origin when sec-fetch-site is not cross-site', () => {
    expect(shouldBlockCrossSiteMutation('POST', undefined, 'same-origin', allowedOrigin)).toBe(false);
  });
});
