import { Oidc, User } from '@edanalytics/models-server';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import config from 'config';
// Loads the express-session types so the SessionData augmentation below resolves
import 'express-session';
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

@Injectable()
export class RegisterOidcIdpsService implements OnModuleInit {
  private readonly oidcClients = new Map<number, BaseClient>();

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
    await Promise.all(oidcConfigs.map((oidcConfig) => this.registerIdp(oidcConfig)));
  }

  /**
   * Returns the id of the only registered provider when exactly one exists.
   * Used as a logout fallback for sessions created before the login provider
   * was tracked on the session.
   */
  getSoleOidcId(): number | undefined {
    if (this.oidcClients.size === 1) {
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
    if (!client?.issuer.metadata.end_session_endpoint) {
      return null;
    }
    return client.endSessionUrl({
      id_token_hint: idToken,
      post_logout_redirect_uri: `${config.MY_URL_API_PATH}/auth/post-logout`,
      client_id: client.metadata.client_id,
    });
  }

  private async registerIdp(oidcConfig: Oidc): Promise<void> {
    let client: BaseClient;
    try {
      const trustIssuer = await Issuer.discover(
        `${oidcConfig.issuer}/.well-known/openid-configuration`
      );
      client = new trustIssuer.Client({
        client_id: oidcConfig.clientId,
        client_secret: oidcConfig.clientSecret,
      });
    } catch (err) {
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
        let username: string | undefined = undefined;
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
