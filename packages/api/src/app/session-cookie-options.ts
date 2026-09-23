import { CookieOptions } from 'express-session';

export const SESSION_TRUST_PROXY_HOPS = 1;

export function getSessionCookieOptions(nodeEnv = process.env.NODE_ENV): CookieOptions {
  return {
    secure: nodeEnv === 'production' ? true : 'auto',
    httpOnly: true,
    sameSite: 'lax',
  };
}
