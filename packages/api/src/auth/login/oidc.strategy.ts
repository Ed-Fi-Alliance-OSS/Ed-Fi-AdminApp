import { UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Client, Issuer, Strategy, TokenSet, UserinfoResponse } from 'openid-client';
import { environment } from '../../environments/environment.local';
import { AuthService } from '../auth.service';

export const buildOpenIdClient = async () => {
  try {
    const TrustIssuer = await Issuer.discover(`${environment.OAUTH2_CLIENT_PROVIDER_OIDC_ISSUER}/.well-known/openid-configuration`);
    const client = new TrustIssuer.Client({
      client_id: environment.OAUTH2_CLIENT_REGISTRATION_LOGIN_CLIENT_ID,
      client_secret: environment.OAUTH2_CLIENT_REGISTRATION_LOGIN_CLIENT_SECRET,
    });
    return client;
  } catch (oidcConfigError) {
    console.warn("Error configuring OIDC client.")
    throw oidcConfigError
  }
};

export class OidcStrategy extends PassportStrategy(Strategy, 'oidc') {
  client: Client;

  constructor(private readonly authService: AuthService, client: Client) {
    super({
      client: client,
      params: {
        redirect_uri: environment.OAUTH2_CLIENT_REGISTRATION_LOGIN_REDIRECT_URI,
        scope: environment.OAUTH2_CLIENT_REGISTRATION_LOGIN_SCOPE,
      },
      passReqToCallback: false,
      usePKCE: false,
    });

    this.client = client;
  }

  async validate(tokenset: TokenSet): Promise<any> {
    const userinfo: UserinfoResponse = await this.client.userinfo(tokenset);

    try {
      const user = await this.authService.findOrCreateUser({
        username: userinfo.preferred_username,
        givenName: userinfo.given_name,
        familyName: userinfo.family_name,
      })
      return user;
    } catch (err) {
      throw new UnauthorizedException();
    }
  }
}