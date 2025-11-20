import { Oidc, User } from '@edanalytics/models-server';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import config from 'config';
import { BaseClient, Issuer, Strategy, TokenSet } from 'openid-client';
import passport from 'passport';
import { Repository } from 'typeorm';
import { AuthService } from '../auth.service';

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
        try {
          const TrustIssuer = await Issuer.discover(
            `${oidcConfig.issuer}/.well-known/openid-configuration`
          );
          client = new TrustIssuer.Client({
            client_id: oidcConfig.clientId,
            client_secret: oidcConfig.clientSecret,
          });
        } catch (err) {
          Logger.error(`Error registering OIDC provider ${oidcConfig.issuer}: ${err}`);
        }
        if (client) {
          const strategy = new Strategy(
            {
              client,
              params: {
                redirect_uri: `${config.MY_URL_API_PATH}/auth/callback/${oidcConfig.id}`,
                scope: oidcConfig.scope,
              },
              usePKCE: config.USE_PKCE,
            },
            async (_: TokenSet, userinfo, done) => {
              let username: string | undefined = undefined;
              if (typeof userinfo.email !== 'string' || userinfo.email === '') {
                throw new Error('Invalid email from IdP');
              } else {
                username = userinfo.email;
              }

              try {
                const user: User = await this.authService.validateUser({ username });
                const isEaUser = username.includes('edanalytics.org');
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
                  return done(null, user);
                }
              } catch (err) {
                Logger.error(`Database error during authentication for user [${username}]:`, err);
                // Return a database error to trigger appropriate error handling
                return done(new Error('Database connection error during authentication'), false);
              }
            }
          );
          Logger.log(`Registering OIDC provider ${oidcConfig.issuer} with id ${oidcConfig.id}`);
          passport.use(`oidc-${oidcConfig.id}`, strategy);
        }
      });
    });
  }
}

export const USER_NOT_FOUND = 'User not found';
export const NO_ROLE = 'No role assigned for user';
export const NO_TEAM_MEMBERSHIPS = 'No team memberships assigned';
