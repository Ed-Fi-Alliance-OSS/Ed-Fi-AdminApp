import { Oidc, User } from '@edanalytics/models-server';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import config from 'config';
// Loads the express-session types so the SessionData augmentation below resolves
import type {} from 'express-session';
import { BaseClient, Issuer, Strategy, TokenSet, UserinfoResponse } from 'openid-client';
import passport from 'passport';
import { Repository } from 'typeorm';
import { AuthService } from '../auth.service';

declare module 'express-session' {
  interface SessionData {
    oidcId?: number;
    idToken?: string;
  }
}

export interface OidcLoginInfo {
  idToken?: string;
}

const DEFAULT_OIDC_DISCOVERY_TIMEOUT_MS = 10000;

@Injectable()
export class RegisterOidcIdpsService implements OnModuleInit {
  private readonly oidcClients = new Map<number, BaseClient>();

  // Number of providers found in configuration, regardless of whether their
  // discovery/registration ultimately succeeded. Lets us tell "one provider
  // configured" apart from "one provider left standing after a failure".
  private configuredProviderCount = 0;

  // Ids of configured providers whose registration failed, so a broken provider
  // can be told apart from one that is healthy but exposes no RP-logout support.
  private readonly failedProviderIds = new Set<number>();

  constructor(
    @InjectRepository(Oidc)
    private readonly oidcRepo: Repository<Oidc>,
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  async onModuleInit(): Promise<void> {
    let oidcConfigs: Oidc[];
    try {
      oidcConfigs = await this.oidcRepo.find();
    } catch (err) {
      Logger.error(`Error loading OIDC provider configurations: ${err}`);
      return;
    }
    this.configuredProviderCount = oidcConfigs.length;
    this.failedProviderIds.clear();
    await Promise.all(
      oidcConfigs.map((oidcConfig) =>
        this.registerIdp(oidcConfig).catch((err) => {
          this.failedProviderIds.add(oidcConfig.id);
          Logger.error(`Unexpected error registering OIDC provider ${oidcConfig.issuer}: ${err}`);
        })
      )
    );

    const failedIds = [...this.failedProviderIds];
    if (failedIds.length > 0) {
      Logger.warn(
        `OIDC provider registration incomplete: ${failedIds.length} of ${this.configuredProviderCount} configured provider(s) failed to register (ids: ${failedIds.join(', ')}). Logout for sessions on those providers will be local-only.`
      );
    }
  }

  /**
   * Returns the id of the only registered provider when exactly one exists.
   * Used as a logout fallback for sessions created before the login provider
   * was tracked on the session.
   */
  getSoleOidcId(): number | undefined {
    // Only infer the provider when exactly one was *configured*. If a second
    // configured provider failed discovery, a legacy session may have logged in
    // with it, so the lone survivor must not be assumed to be the right one.
    if (this.configuredProviderCount === 1 && this.oidcClients.size === 1) {
      return this.oidcClients.keys().next().value;
    }
    return undefined;
  }

  /**
   * Builds the RP-Initiated Logout URL for the provider the user logged in with,
   * based on the end_session_endpoint discovered from the provider's metadata.
   * Returns null when the provider does not expose an end_session_endpoint
   * (e.g. Google), in which case only a local logout is possible.
   */
  getEndSessionUrl(oidcId: number, idToken?: string): string | null {
    const client = this.oidcClients.get(oidcId);
    if (!client) {
      // The provider the session logged in with is not registered (never
      // configured, or failed discovery at startup). This is distinct from a
      // healthy provider that simply exposes no end_session_endpoint, so it is
      // logged rather than treated as expected local-only behavior.
      Logger.warn(`Cannot build end-session URL: OIDC provider ${oidcId} is not registered`);
      return null;
    }
    if (!client.issuer.metadata.end_session_endpoint) {
      return null;
    }
    return client.endSessionUrl({
      id_token_hint: idToken,
      post_logout_redirect_uri: `${config.MY_URL_API_PATH}/auth/post-logout`,
      client_id: client.metadata.client_id,
    });
  }

  /**
   * Runs OIDC discovery with a bounded timeout so a slow or unresponsive
   * provider cannot stall application bootstrap. Rejects when the provider does
   * not answer within the configured budget.
   */
  private async discoverWithTimeout(discoveryUrl: string, timeoutMs: number): Promise<Issuer> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`OIDC discovery timed out after ${timeoutMs}ms`)),
        timeoutMs
      );
    });
    try {
      return await Promise.race([Issuer.discover(discoveryUrl), timeout]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private async registerIdp(oidcConfig: Oidc): Promise<void> {
    let client: BaseClient;
    try {
      const timeoutMs = config.OIDC_DISCOVERY_TIMEOUT_MS ?? DEFAULT_OIDC_DISCOVERY_TIMEOUT_MS;
      const trustIssuer = await this.discoverWithTimeout(
        `${oidcConfig.issuer}/.well-known/openid-configuration`,
        timeoutMs
      );
      client = new trustIssuer.Client({
        client_id: oidcConfig.clientId,
        client_secret: oidcConfig.clientSecret,
      });
    } catch (err) {
      this.failedProviderIds.add(oidcConfig.id);
      Logger.error(`Error registering OIDC provider ${oidcConfig.issuer}: ${err}`);
      return;
    }

    const strategy = new Strategy(
      {
        client,
        params: {
          redirect_uri: `${config.MY_URL_API_PATH}/auth/callback/${oidcConfig.id}`,
          scope: oidcConfig.scope,
        },
        usePKCE: config.USE_PKCE,
      },
      async (
        tokenset: TokenSet,
        userinfo: UserinfoResponse,
        done: (err: Error | null, user?: User | false, info?: OidcLoginInfo) => void
      ) => {
        let username: string;
        if (typeof userinfo.email !== 'string' || userinfo.email === '') {
          throw new Error('Invalid email from IdP');
        } else {
          username = userinfo.email;
        }

        try {
          const user: User = await this.authService.validateUser({ username });
          const emailDomain = username.substring(username.lastIndexOf('@') + 1).toLowerCase();
          const isEaUser = emailDomain === 'edanalytics.org';
          if (user === null) {
            if (!isEaUser) {
              Logger.warn(`LOGIN_ERROR User [${username}] not found in database`);
            }
            return done(new Error(USER_NOT_FOUND), false);
          } else if (user.roleId === null || user.roleId === undefined) {
            if (!isEaUser) {
              Logger.warn(`LOGIN_ERROR No role assigned for User [${username}]`);
            }
            return done(new Error(NO_ROLE), false);
          } else {
            if (!user.userTeamMemberships || user.userTeamMemberships.length === 0) {
              if (!isEaUser) {
                Logger.warn(`LOGIN_ERROR No team memberships assigned for User [${username}]`);
              }
            }
            // Pass the id_token along so the login callback can store it on the
            // session for use as id_token_hint during RP-Initiated Logout
            return done(null, user, { idToken: tokenset.id_token });
          }
        } catch (err) {
          Logger.error(`Database error during authentication for user [${username}]:`, err);
          // Return a database error to trigger appropriate error handling
          return done(new Error('Database connection error during authentication'), false);
        }
      }
    );
    Logger.log(`Registering OIDC provider ${oidcConfig.issuer} with id ${oidcConfig.id}`);
    this.oidcClients.set(oidcConfig.id, client);
    passport.use(`oidc-${oidcConfig.id}`, strategy);
  }
}

export const USER_NOT_FOUND = 'User not found';
export const NO_ROLE = 'No role assigned for user';
export const NO_TEAM_MEMBERSHIPS = 'No team memberships assigned';
