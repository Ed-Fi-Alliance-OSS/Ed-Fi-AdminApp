import 'reflect-metadata';
import { Issuer } from 'openid-client';
import passport from 'passport';
import { RegisterOidcIdpsService } from './oidc.strategy';

jest.mock('config', () => ({
  FE_URL: 'http://frontend',
  MY_URL_API_PATH: 'http://adminapp/api',
  USE_PKCE: false,
}));

const keycloakOidcRow = {
  id: 1,
  issuer: 'http://keycloak/realms/edfi',
  clientId: 'adminapp-client',
  clientSecret: 'secret',
  scope: 'openid profile email',
};

const googleOidcRow = {
  id: 2,
  issuer: 'https://accounts.google.com',
  clientId: 'google-client',
  clientSecret: 'secret',
  scope: 'openid profile email',
};

const keycloakIssuer = new Issuer({
  issuer: 'http://keycloak/realms/edfi',
  authorization_endpoint: 'http://keycloak/realms/edfi/protocol/openid-connect/auth',
  token_endpoint: 'http://keycloak/realms/edfi/protocol/openid-connect/token',
  userinfo_endpoint: 'http://keycloak/realms/edfi/protocol/openid-connect/userinfo',
  jwks_uri: 'http://keycloak/realms/edfi/protocol/openid-connect/certs',
  end_session_endpoint: 'http://keycloak/realms/edfi/protocol/openid-connect/logout',
});

// Google does not expose an end_session_endpoint in its discovery document
const googleIssuer = new Issuer({
  issuer: 'https://accounts.google.com',
  authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: 'https://oauth2.googleapis.com/token',
  userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
  jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
});

describe('RegisterOidcIdpsService', () => {
  let service: RegisterOidcIdpsService;
  let passportUseSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.restoreAllMocks();
    passportUseSpy = jest.spyOn(passport, 'use').mockImplementation(() => passport);
    jest.spyOn(Issuer, 'discover').mockImplementation((url: string) => {
      if (url.startsWith(keycloakOidcRow.issuer)) {
        return Promise.resolve(keycloakIssuer);
      }
      if (url.startsWith(googleOidcRow.issuer)) {
        return Promise.resolve(googleIssuer);
      }
      return Promise.reject(new Error(`Unexpected discovery URL: ${url}`));
    });

    const oidcRepo = { find: jest.fn().mockResolvedValue([keycloakOidcRow, googleOidcRow]) };
    const authService = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new RegisterOidcIdpsService(oidcRepo as any, authService as any);
    await service.onModuleInit();
  });

  it('registers a passport strategy per configured provider', () => {
    expect(passportUseSpy).toHaveBeenCalledWith('oidc-1', expect.any(Object));
    expect(passportUseSpy).toHaveBeenCalledWith('oidc-2', expect.any(Object));
  });

  describe('getEndSessionUrl', () => {
    it('builds the logout URL from the discovered end_session_endpoint', () => {
      const url = service.getEndSessionUrl(keycloakOidcRow.id, 'the-id-token');

      expect(url).not.toBeNull();
      const parsed = new URL(url);
      expect(`${parsed.origin}${parsed.pathname}`).toBe(
        'http://keycloak/realms/edfi/protocol/openid-connect/logout',
      );
      expect(parsed.searchParams.get('id_token_hint')).toBe('the-id-token');
      expect(parsed.searchParams.get('post_logout_redirect_uri')).toBe(
        'http://adminapp/api/auth/post-logout',
      );
      expect(parsed.searchParams.get('client_id')).toBe('adminapp-client');
    });

    it('omits id_token_hint when no id_token is available', () => {
      const url = service.getEndSessionUrl(keycloakOidcRow.id);

      const parsed = new URL(url);
      expect(parsed.searchParams.has('id_token_hint')).toBe(false);
      expect(parsed.searchParams.get('client_id')).toBe('adminapp-client');
    });

    it('returns null for a provider without an end_session_endpoint', () => {
      expect(service.getEndSessionUrl(googleOidcRow.id, 'the-id-token')).toBeNull();
    });

    it('returns null for an unknown provider id', () => {
      expect(service.getEndSessionUrl(999, 'the-id-token')).toBeNull();
    });
  });

  describe('getSoleOidcId', () => {
    it('returns undefined when more than one provider is registered', () => {
      expect(service.getSoleOidcId()).toBeUndefined();
    });
  });

  describe('when discovery fails for one provider', () => {
    beforeEach(async () => {
      jest.spyOn(Issuer, 'discover').mockImplementation((url: string) => {
        if (url.startsWith(keycloakOidcRow.issuer)) {
          return Promise.resolve(keycloakIssuer);
        }
        return Promise.reject(new Error('discovery unavailable'));
      });

      const oidcRepo = { find: jest.fn().mockResolvedValue([keycloakOidcRow, googleOidcRow]) };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      service = new RegisterOidcIdpsService(oidcRepo as any, {} as any);
      await service.onModuleInit();
    });

    it('still registers the providers that discovered successfully', () => {
      expect(service.getEndSessionUrl(keycloakOidcRow.id, 'token')).not.toBeNull();
      expect(service.getEndSessionUrl(googleOidcRow.id, 'token')).toBeNull();
    });

    it('treats the single surviving provider as the sole provider', () => {
      expect(service.getSoleOidcId()).toBe(keycloakOidcRow.id);
    });
  });
});
