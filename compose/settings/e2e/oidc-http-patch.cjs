const http = require('http');
const https = require('https');
const { URL } = require('url');

function parseUrl(url) {
  if (typeof url === 'string') {
    return new URL(url);
  }

  if (url instanceof URL) {
    return url;
  }

  return null;
}

function shouldRewrite(url) {
  if (!url || url.hostname !== 'localhost') {
    return false;
  }

  const path = url.pathname || '';
  return (
    path.includes('/.well-known/openid-configuration') ||
    path.includes('/protocol/openid-connect/token') ||
    path.includes('/protocol/openid-connect/userinfo') ||
    path.includes('/protocol/openid-connect/revoke') ||
    path.includes('/protocol/openid-connect/introspect') ||
    path.includes('/protocol/openid-connect/certs')
  );
}

function shouldRewriteOptions(options) {
  const hostname = options && (options.hostname || options.host);
  const path = options && options.path;
  if (hostname !== 'localhost' || typeof path !== 'string') {
    return false;
  }

  return (
    path.includes('/.well-known/openid-configuration') ||
    path.includes('/protocol/openid-connect/token') ||
    path.includes('/protocol/openid-connect/userinfo') ||
    path.includes('/protocol/openid-connect/revoke') ||
    path.includes('/protocol/openid-connect/introspect') ||
    path.includes('/protocol/openid-connect/certs')
  );
}

function maybeLog(message) {
  if (process.env.OIDC_PATCH_DEBUG === 'true') {
    // eslint-disable-next-line no-console
    console.log(`[oidc-http-patch] ${message}`);
  }
}

function applyExternalHostHeaders(headers = {}) {
  return {
    ...headers,
    host: 'localhost',
    'x-forwarded-host': 'localhost',
    'x-forwarded-proto': 'https',
    'x-forwarded-port': '443',
  };
}

if (process.env.PLAYWRIGHT_E2E === 'true') {
  const originalHttpsRequest = https.request;
  const originalHttpRequest = http.request;
  https.request = function patchedHttpsRequest(url, options, callback) {
    const parsed = parseUrl(url);

    if (shouldRewrite(parsed)) {
      const rewrittenOptions = {
        protocol: 'http:',
        hostname: 'edfiadminapp-keycloak',
        host: 'edfiadminapp-keycloak',
        port: 8080,
        path: `${parsed.pathname}${parsed.search || ''}`,
        method: (options && options.method) || 'GET',
        headers: {
          ...((options && options.headers) || {}),
        },
      };

      rewrittenOptions.headers = applyExternalHostHeaders(rewrittenOptions.headers);

      maybeLog(`HTTPS URL rewrite ${parsed.toString()} -> http://edfiadminapp-keycloak:8080${rewrittenOptions.path}`);
      return originalHttpRequest.call(http, rewrittenOptions, callback);
    }

    if (!parsed && shouldRewriteOptions(url)) {
      const rewrittenOptions = {
        ...url,
        hostname: 'edfiadminapp-keycloak',
        host: 'edfiadminapp-keycloak',
        port: 8080,
        protocol: 'http:',
        headers: {
          ...(url.headers || {}),
        },
      };

      rewrittenOptions.headers = applyExternalHostHeaders(rewrittenOptions.headers);

      maybeLog(`HTTPS options rewrite ${url.hostname || url.host}${url.path || ''} -> ${rewrittenOptions.hostname}${rewrittenOptions.path || ''}`);
      return originalHttpRequest.call(http, rewrittenOptions, options, callback);
    }

    return originalHttpsRequest.call(https, url, options, callback);
  };

  http.request = function patchedHttpRequest(url, options, callback) {
    const parsed = parseUrl(url);

    if (shouldRewrite(parsed)) {
      const rewrittenOptions = {
        protocol: 'http:',
        hostname: 'edfiadminapp-keycloak',
        host: 'edfiadminapp-keycloak',
        port: 8080,
        path: `${parsed.pathname}${parsed.search || ''}`,
        method: (options && options.method) || 'GET',
        headers: applyExternalHostHeaders((options && options.headers) || {}),
      };

      maybeLog(`HTTP URL rewrite ${parsed.toString()} -> http://edfiadminapp-keycloak:8080${rewrittenOptions.path}`);
      return originalHttpRequest.call(http, rewrittenOptions, callback);
    }

    if (!parsed && shouldRewriteOptions(url)) {
      const rewrittenOptions = {
        ...url,
        protocol: 'http:',
        hostname: 'edfiadminapp-keycloak',
        host: 'edfiadminapp-keycloak',
        port: 8080,
        headers: applyExternalHostHeaders((url && url.headers) || {}),
      };
      maybeLog(`HTTP options rewrite ${url.hostname || url.host}${url.path || ''} -> ${rewrittenOptions.hostname}${rewrittenOptions.path || ''}`);
      return originalHttpRequest.call(http, rewrittenOptions, options, callback);
    }

    return originalHttpRequest.call(http, url, options, callback);
  };

  maybeLog('Patch loaded (PLAYWRIGHT_E2E=true)');
}
