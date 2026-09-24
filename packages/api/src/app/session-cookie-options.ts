import { CookieOptions } from 'express-session';

export const SESSION_TRUST_PROXY_HOPS = 1;

export function getSessionCookieOptions(): CookieOptions {
  return {
    secure: 'auto',
    httpOnly: true,
    sameSite: 'lax',
  };
}
