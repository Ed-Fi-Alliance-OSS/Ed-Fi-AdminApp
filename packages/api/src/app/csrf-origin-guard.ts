import { NextFunction, Request, Response } from 'express';

const IDEMPOTENT_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const normalizeOrigin = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).origin;
  } catch {
    return value.trim();
  }
};

const sameOrigin = (requestOrigin: string, allowedOrigin: string): boolean => {
  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
  const normalizedAllowedOrigin = normalizeOrigin(allowedOrigin);
  return normalizedRequestOrigin === normalizedAllowedOrigin;
};

export const shouldBlockCrossSiteMutation = (
  method: string,
  originHeader: string | undefined,
  secFetchSiteHeader: string | undefined,
  allowedOrigin: string
): boolean => {
  if (IDEMPOTENT_HTTP_METHODS.has(method.toUpperCase())) {
    return false;
  }

  if (secFetchSiteHeader?.toLowerCase() === 'cross-site') {
    return true;
  }

  if (originHeader && !sameOrigin(originHeader, allowedOrigin)) {
    return true;
  }

  return false;
};

export const createCsrfOriginGuard = (allowedOrigin: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originHeader = req.get('origin');
    const secFetchSiteHeader = req.get('sec-fetch-site');

    if (shouldBlockCrossSiteMutation(req.method, originHeader, secFetchSiteHeader, allowedOrigin)) {
      res.status(403).send('Forbidden');
      return;
    }

    next();
  };
};
