// packages/api/src/certification/certification-token.service.ts
import {
  CertificationTokenDto,
  PostSbEnvironmentDto,
  resolveOdsApiUrls,
} from '@edanalytics/models';
import { EdfiTenant, Ods, SbEnvironment } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { isAxiosError } from 'axios';
import config from 'config';
import { Repository } from 'typeorm';
import { fetchOdsApiMetadata, throwNotFound, ValidationHttpException } from '../utils';

export const CERT_TOKEN_MESSAGES = {
  notConfigured: 'This environment has no ODS/API discovery URL, so it cannot be certified.',
  contextRouting:
    "This environment uses context-based routing, which certification doesn't support yet.",
  invalidCredentials: 'Key or secret not valid for this tenant.',
  noTokenEndpoint: (oauthUrl: string) => `The Ed-Fi API has no token endpoint at ${oauthUrl}.`,
  unreachable: (oauthUrl: string) => `Couldn't reach the Ed-Fi API at ${oauthUrl}.`,
  odsRequired: "Choose the ODS / Data Store you're certifying.",
  untrustedTokenUrl:
    "The Ed-Fi API's token address isn't on the same secure host as this environment, so the credentials weren't sent.",
};

/**
 * The token URL comes from the discovery document, which the secret is then sent to.
 * Only send it over https to the same host (and port) the discovery document came from,
 * and never to a URL that carries credentials.
 */
export const isTrustedTokenUrl = (tokenUrl: string, discoveryUrl: string): boolean => {
  try {
    const token = new URL(tokenUrl);
    const discovery = new URL(discoveryUrl);
    if (token.username || token.password) return false;
    return token.protocol === 'https:' && token.host === discovery.host;
  } catch {
    return false;
  }
};

@Injectable()
export class CertificationTokenService {
  constructor(
    @InjectRepository(Ods)
    private readonly odsRepository: Repository<Ods>,
  ) {}

  /**
   * Exchanges the user's key and secret for an ODS/API token (AC-673).
   * The key, secret and token are never stored or logged.
   */
  async requestToken({
    sbEnvironment,
    edfiTenant,
    odsId,
    key,
    secret,
  }: {
    sbEnvironment: SbEnvironment;
    edfiTenant: EdfiTenant;
    odsId?: number;
    key: string;
    secret: string;
  }): Promise<CertificationTokenDto> {
    if (odsId !== undefined) {
      await this.odsRepository
        .findOneByOrFail({ id: odsId, edfiTenantId: edfiTenant.id })
        .catch(throwNotFound);
    } else if ((await this.odsRepository.countBy({ edfiTenantId: edfiTenant.id })) > 0) {
      // Mirrors the form, which only hides the ODS field when the tenant has none.
      throw new ValidationHttpException(CERT_TOKEN_MESSAGES.odsRequired);
    }

    const discoveryUrl = sbEnvironment.domain;
    if (!discoveryUrl) {
      throw new ValidationHttpException(CERT_TOKEN_MESSAGES.notConfigured);
    }
    // Re-fetch instead of trusting configPublic.odsApiMeta, which can be stale
    // after the environment's discovery URL is edited (AC-673 §4).
    const discovery = await fetchOdsApiMetadata({
      odsApiDiscoveryUrl: discoveryUrl,
    } as PostSbEnvironmentDto);
    const resolved = resolveOdsApiUrls(discovery?.urls, edfiTenant.name);
    if (resolved.status === 'context-routing') {
      throw new ValidationHttpException(CERT_TOKEN_MESSAGES.contextRouting);
    }
    if (resolved.status === 'missing-urls') {
      throw new ValidationHttpException(CERT_TOKEN_MESSAGES.notConfigured);
    }

    if (!isTrustedTokenUrl(resolved.oauthUrl, discoveryUrl)) {
      throw new ValidationHttpException(CERT_TOKEN_MESSAGES.untrustedTokenUrl);
    }

    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');
    body.set('client_id', key);
    body.set('client_secret', secret);

    try {
      const response = await axios.post(resolved.oauthUrl, body, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: config.EDFI_URLS_TIMEOUT_MS,
        // Never follow a redirect: the body carries client_secret.
        maxRedirects: 0,
      });
      const { access_token, expires_in } = response.data ?? {};
      if (typeof access_token !== 'string' || typeof expires_in !== 'number') {
        throw new ValidationHttpException(CERT_TOKEN_MESSAGES.unreachable(resolved.oauthUrl));
      }
      return {
        token: access_token,
        expiresAt: new Date(Date.now() + expires_in * 1000).toISOString(),
        oauthUrl: resolved.oauthUrl,
        resourceBaseUrl: resolved.resourceBaseUrl,
      };
    } catch (error) {
      // Never log `error`: error.config.data contains client_secret.
      if (error instanceof ValidationHttpException) throw error;
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (status === 400 || status === 401) {
        throw new ValidationHttpException(CERT_TOKEN_MESSAGES.invalidCredentials);
      }
      if (status === 404) {
        throw new ValidationHttpException(CERT_TOKEN_MESSAGES.noTokenEndpoint(resolved.oauthUrl));
      }
      throw new ValidationHttpException(CERT_TOKEN_MESSAGES.unreachable(resolved.oauthUrl));
    }
  }
}
