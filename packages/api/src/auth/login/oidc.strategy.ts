import { Oidc, User } from '@edanalytics/models-server';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import config from 'config';
import { BaseClient, Issuer, Strategy, TokenSet } from 'openid-client';
import http from 'http';
import https from 'https';
import passport from 'passport';
import { Repository } from 'typeorm';
import { AuthService } from '../auth.service';
import { URL } from 'url';

// Only apply localhost→edfiadminapp-keycloak patching when running in Docker/production
// This prevents breaking development environments, tests, and other deployments
const SHOULD_PATCH_LOCALHOST =
  process.env.NODE_ENV === 'production' ||
  process.env.KC_HOSTNAME === 'localhost' ||
  process.env.RUNNING_IN_DOCKER === 'true';

if (SHOULD_PATCH_LOCALHOST) {
  // Monkey-patch https.request to rewrite localhost URLs to internal container URLs
  // This handles the Docker networking issue where localhost doesn't resolve to nginx proxy
  const originalHttpsRequest = https.request;
  const patchedHttpsRequest = function(url: string | URL | any, options?: any, callback?: any) {
    const resolvedUrl = typeof url === 'string' ? new URL(url) : url instanceof URL ? url : null;

    if (resolvedUrl && resolvedUrl.hostname === 'localhost' && resolvedUrl.pathname.includes('/auth/realms/')) {
      // Rewrite localhost to internal Keycloak container
      resolvedUrl.hostname = 'edfiadminapp-keycloak';
      resolvedUrl.port = '8080';
      resolvedUrl.protocol = 'http'; // Use HTTP for internal container communication
      // Call original with rewritten URL
      return originalHttpsRequest.call(https, resolvedUrl, options, callback);
    }
    // Call original for non-localhost requests
    return originalHttpsRequest.call(https, url, options, callback);
  };
  https.request = patchedHttpsRequest as any;

  // Also patch http.request for completeness
  const originalHttpRequest = http.request;
  const patchedHttpRequest = function(url: string | URL | any, options?: any, callback?: any) {
    const resolvedUrl = typeof url === 'string' ? new URL(url) : url instanceof URL ? url : null;

    if (resolvedUrl && resolvedUrl.hostname === 'localhost' && resolvedUrl.pathname.includes('/auth/realms/')) {
      // Rewrite localhost to internal Keycloak container
      resolvedUrl.hostname = 'edfiadminapp-keycloak';
      resolvedUrl.port = '8080';
      // Call original with rewritten URL
      return originalHttpRequest.call(http, resolvedUrl, options, callback);
    }
    // Call original for non-localhost requests
    return originalHttpRequest.call(http, url, options, callback);
  };
  http.request = patchedHttpRequest as any;
}

/**
 * Custom HTTPS Agent that rewrites localhost URLs to internal Keycloak container URLs.
 * This solves the Docker networking issue where localhost inside a container doesn't
 * resolve to the nginx proxy, it resolves to the container itself.
 */
class LocalhostToDockerAgent extends https.Agent {
  createConnection(options: any, callback: any) {
    const originalHostname = options.hostname;

    // If the request is to localhost/auth/realms/*, redirect to internal Keycloak container
    if (originalHostname === 'localhost' && options.path && options.path.includes('/auth/realms/')) {
      options.hostname = 'edfiadminapp-keycloak';
    }

    return super.createConnection(options, callback);
  }
}

/**
 * Custom HTTP Agent for the same purpose (though OIDC typically uses HTTPS)
 */
class LocalhostToDockerHttpAgent extends http.Agent {
  createConnection(options: any, callback: any) {
    const originalHostname = options.hostname;

    // If the request is to localhost/auth/realms/*, redirect to internal Keycloak container
    if (originalHostname === 'localhost' && options.path && options.path.includes('/auth/realms/')) {
      options.hostname = 'edfiadminapp-keycloak';
    }

    return super.createConnection(options, callback);
  }
}

@Injectable()
export class RegisterOidcIdpsService {
  constructor(
    @InjectRepository(Oidc)
    private readonly oidcRepo: Repository<Oidc>,
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {
    this.oidcRepo.find().then((oidcs) => {
      oidcs.forEach(async (oidcConfig) => {
        let client: BaseClient;
        let TrustIssuer: Issuer | null = null;

        try {
          // Try to discover OIDC provider, attempting multiple URLs for compatibility
          const discoveryUrls = this.getDiscoveryUrls(oidcConfig.issuer);
          let lastError: Error | null = null;

          for (const discoveryUrl of discoveryUrls) {
            try {
              TrustIssuer = await Issuer.discover(discoveryUrl);
              break;
            } catch (err) {
              lastError = err as Error;
              continue;
            }
          }

          if (!TrustIssuer) {
            throw lastError || new Error('Could not discover OIDC provider with any URL');
          }

          client = new TrustIssuer.Client({
            client_id: oidcConfig.clientId,
            client_secret: oidcConfig.clientSecret,
          });

          // Rewrite all endpoint URLs to use the internal container base URL.
          // Discovery may succeed via internal URL but the returned metadata still contains
          // external URLs (e.g. https://localhost/auth/...) for token_endpoint, userinfo_endpoint, etc.
          // The API container cannot reach https://localhost (it resolves to itself, not nginx),
          // so we replace the external base with the internal one for all backchannel calls.
          const internalBase = this.getInternalBaseUrl(oidcConfig.issuer);
          if (internalBase) {
            const externalBase = oidcConfig.issuer;

            // Try to patch endpoint URLs on the client instance
            const endpointProps = [
              'token_endpoint',
              'userinfo_endpoint',
              'authorization_endpoint',
              'revocation_endpoint',
              'introspection_endpoint',
              'jwks_uri',
              'registration_endpoint',
              'issuer',
            ];

            for (const prop of endpointProps) {
              try {
                const descriptor = Object.getOwnPropertyDescriptor(client, prop);
                const current = (client as any)[prop];

                if (typeof current === 'string' && current.includes(externalBase)) {
                  const newValue = current.replace(externalBase, internalBase);
                  // Try assignment
                  (client as any)[prop] = newValue;
                }
              } catch (err) {
                // Silently ignore if endpoint cannot be rewritten
              }
            }
          }
        } catch (err) {
          return;
        }

        if (!client) {
          return;
        }

        try {
          const strategy = new Strategy(
            {
              client,
              params: {
                redirect_uri: `${config.MY_URL_API_PATH}/auth/callback/${oidcConfig.id}`,
                scope: oidcConfig.scope || 'openid profile email',
              },
              usePKCE: config.USE_PKCE,
            },
            async (_: TokenSet, userinfo: any, done: any) => {
              let username: string | undefined = undefined;
              try {
                if (typeof userinfo.email !== 'string' || userinfo.email === '') {
                  return done(new Error('Invalid email from IdP'), false);
                }
                username = userinfo.email;

                const user: User | null = await this.authService.validateUser({ username });
                const emailDomain = username!.substring(username!.lastIndexOf('@') + 1).toLowerCase();
                const isEaUser = emailDomain === 'edanalytics.org';

                if (user === null) {
                  return done(new Error(USER_NOT_FOUND), false);
                }

                if (user.roleId === null || user.roleId === undefined) {
                  return done(new Error(NO_ROLE), false);
                }

                if (!user.userTeamMemberships || user.userTeamMemberships.length === 0) {
                  // No team memberships, but login will still proceed
                }

                return done(null, user);
              } catch (err) {
                // Return a database error to trigger appropriate error handling
                return done(new Error('Database connection error during authentication'), false);
              }
            }
          );
          passport.use(`oidc-${oidcConfig.id}`, strategy);
        } catch (strategyErr) {
          // Error creating strategy - silently fail to not block other providers
        }
      });
    }).catch((err) => {
      // Error loading providers - continue without OIDC
    });
  }

  /**
   * Generate a list of discovery URLs to try for a given issuer.
   * This handles both internal Docker container URLs and external URLs.
   * @param issuer The issuer URL (typically external URL like https://localhost/auth/realms/edfi)
   * @returns Array of discovery URLs to try
   */
  private getDiscoveryUrls(issuer: string): string[] {
    const urls: string[] = [];

    // If issuer contains /auth/realms/, also try internal container URL
    if (issuer.includes('/auth/realms/')) {
      const realmMatch = issuer.match(/\/auth\/realms\/([^\/]+)/);
      if (realmMatch) {
        const realmName = realmMatch[1];
        // Try internal Docker container URL first (more reliable within Docker network)
        urls.push(`http://edfiadminapp-keycloak:8080/auth/realms/${realmName}/.well-known/openid-configuration`);
      }
    }

    // Always include the provided issuer URL as fallback
    urls.push(`${issuer}/.well-known/openid-configuration`);

    return urls;
  }

  /**
   * Derive the internal Docker container base URL from the external issuer URL.
   * Returns null if we cannot determine an internal URL (e.g. non-Keycloak issuers).
   */
  private getInternalBaseUrl(issuer: string): string | null {
    const realmMatch = issuer.match(/\/auth\/realms\/([^\/]+)/);
    if (realmMatch) {
      const realmName = realmMatch[1];
      return `http://edfiadminapp-keycloak:8080/auth/realms/${realmName}`;
    }
    return null;
  }
}

export const USER_NOT_FOUND = 'User not found';
export const NO_ROLE = 'No role assigned for user';
export const NO_TEAM_MEMBERSHIPS = 'No team memberships assigned';
