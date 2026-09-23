import { getSessionCookieOptions, SESSION_TRUST_PROXY_HOPS } from './session-cookie-options';

describe('getSessionCookieOptions', () => {
  it('forces secure cookies in production', () => {
    expect(getSessionCookieOptions('production')).toEqual({
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
    });
  });

  it('uses auto secure cookies outside production', () => {
    expect(getSessionCookieOptions('development')).toEqual({
      secure: 'auto',
      httpOnly: true,
      sameSite: 'lax',
    });
  });
});

describe('SESSION_TRUST_PROXY_HOPS', () => {
  it('trusts a single proxy hop for forwarded protocol headers', () => {
    expect(SESSION_TRUST_PROXY_HOPS).toBe(1);
  });
});
