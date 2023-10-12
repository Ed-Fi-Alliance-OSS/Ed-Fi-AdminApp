import { InvokeCommand, LambdaClient, LambdaServiceException } from '@aws-sdk/client-lambda';
import { parse, validate } from '@aws-sdk/util-arn-parser';
import {
  PostApplicationDto,
  PostApplicationResponseDto,
  PostClaimsetDto,
  PostVendorDto,
  PutApplicationDto,
  PutClaimsetDto,
  PutVendorDto,
  SbMetaEnv,
  toGetApplicationDto,
  toGetClaimsetDto,
  toGetVendorDto,
} from '@edanalytics/models';
import { Sbe } from '@edanalytics/models-server';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { AxiosError } from 'axios';
import ClientOAuth2 from 'client-oauth2';
import crypto from 'crypto';
import NodeCache from 'node-cache';
import { CustomHttpException } from '../../../utils';
import { Repository } from 'typeorm';
/* eslint @typescript-eslint/no-explicit-any: 0 */ // --> OFF

@Injectable()
export class StartingBlocksService {
  constructor(
    @InjectRepository(Sbe)
    private sbesRepository: Repository<Sbe>
  ) {}

  async getSbMeta(sbe: Sbe) {
    const { configPrivate, configPublic } = sbe;
    if (!validate(sbe.configPublic.sbeMetaArn ?? '')) {
      return {
        status: 'INVALID_ARN' as const,
      };
    }
    const arn = parse(sbe.configPublic.sbeMetaArn);
    const client = new LambdaClient({
      region: arn.region,
      credentials:
        configPublic.sbeMetaKey && configPrivate.sbeMetaSecret
          ? {
              accessKeyId: configPublic.sbeMetaKey,
              secretAccessKey: configPrivate.sbeMetaSecret,
            }
          : undefined,
    });
    try {
      const result = await client.send(
        new InvokeCommand({
          FunctionName: sbe.configPublic.sbeMetaArn,
          InvocationType: 'RequestResponse',
        })
      );
      return {
        status: 'SUCCESS' as const,
        data: JSON.parse(Buffer.from(result.Payload).toString('utf8')) as SbMetaEnv,
      };
    } catch (LambdaError: unknown) {
      const err = LambdaError as LambdaServiceException;
      Logger.error(LambdaError);
      return {
        status: 'FAILURE' as const,
        error: err.message ? (err.message as string) : 'Failed to execute SB Lambda',
      };
    }
  }
}
/**
 * This service is used to interact with the Admin API. Each method is a single
 * API call (plus login if token is expired).
 *
 * Each call uses the `getAdminApiClient` method, which throws explicit HTTP 500s
 * and doesn't leak any internal exceptions. So any Axios errors (e.g. 404) or
 * other non-Nest exceptions encountered externally can be assumed to have arisen
 * in the actual call of interest.
 */
@Injectable()
export class AdminApiService {
  adminApiTokens: NodeCache;

  constructor() {
    this.adminApiTokens = new NodeCache({ checkperiod: 60 });
  }

  async logIntoAdminApi(sbe: Sbe) {
    if (typeof sbe?.configPublic?.adminApiUrl !== 'string') {
      return {
        status: 'NO_ADMIN_API_URL' as const,
      };
    }
    const url = `${sbe.configPublic.adminApiUrl.replace(/\/$/, '')}/connect/token`;
    try {
      new URL(url);
    } catch (InvalidUrl) {
      Logger.log(InvalidUrl);
      return {
        status: 'INVALID_ADMIN_API_URL' as const,
      };
    }
    const AdminApiAuth = new ClientOAuth2({
      clientId: sbe.configPublic.adminApiKey,
      clientSecret: sbe.configPrivate.adminApiSecret,
      accessTokenUri: `${sbe.configPublic.adminApiUrl.replace(/\/$/, '')}/connect/token`,
      scopes: ['edfi_admin_api/full_access'],
    });

    try {
      await AdminApiAuth.credentials.getToken().then((v) => {
        this.adminApiTokens.set(sbe.id, v.accessToken, Number(v.data.expires_in) - 60);
      });
      return {
        status: 'SUCCESS' as const,
      };
    } catch (LoginFailed) {
      if (LoginFailed?.code === 'ERR_HTTP2_GOAWAY_SESSION') {
        return {
          status: 'GOAWAY' as const, // TBD what this actually means
        };
      }
      Logger.warn(LoginFailed);
      Logger.log(
        sbe.configPublic?.adminApiUrl,
        sbe.configPublic?.adminApiKey?.length,
        sbe.configPrivate?.adminApiSecret?.length
      );
      return {
        status: 'LOGIN_FAILED' as const,
      };
    }
  }

  async selfRegisterAdminApi(url: string) {
    const ClientId = crypto.randomBytes(12).toString('hex');
    const ClientSecret = crypto.randomBytes(36).toString('hex');
    const DisplayName = `SBAA ${Number(new Date())}ms`;
    const credentials = {
      ClientId,
      ClientSecret,
      DisplayName,
    };

    return axios
      .post(`${url.replace(/\/$/, '')}/connect/register`, credentials, {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      })
      .then(() => {
        return { credentials, status: 'SUCCESS' as const };
      })
      .catch((err: AxiosError<any>) => {
        if (err.response?.data?.errors) {
          Logger.warn(JSON.stringify(err.response.data.errors));
          return {
            status: 'ERROR' as const,
            data: err.response.data as object,
          };
        } else if (err?.code === 'ENOTFOUND') {
          Logger.warn('Attempted to register Admin API but ENOTFOUND: ' + url);
          return {
            status: 'ENOTFOUND' as const,
          };
        } else {
          Logger.warn(err);
          return {
            status: 'ERROR' as const,
          };
        }
      });
  }

  private getAdminApiClient(sbe: Sbe) {
    const client = axios.create({
      baseURL: sbe.configPublic.adminApiUrl,
    });
    client.interceptors.response.use(
      (value) => {
        return value.data.result;
      },
      (err) => {
        Logger.error(err);
        throw err;
      }
    );
    client.interceptors.request.use(async (config) => {
      let token: undefined | string = this.adminApiTokens.get(sbe.id);
      if (token === undefined) {
        const adminLogin = await this.logIntoAdminApi(sbe);

        const adminApiLoginFailureMessages: Record<
          Exclude<(typeof adminLogin)['status'], 'SUCCESS'>,
          string
        > = {
          INVALID_ADMIN_API_URL: 'Invalid Admin API URL configured for environment.',
          NO_ADMIN_API_URL: 'No Admin API URL configured for environment.',
          GOAWAY: 'Admin API not accepting new connections.',
          LOGIN_FAILED: 'Admin API login failed.',
        };

        if (adminApiLoginFailureMessages[adminLogin.status]) {
          throw new CustomHttpException(
            {
              title: adminApiLoginFailureMessages[adminLogin.status],
              type: 'Error',
            },
            500
          );
        }
        token = this.adminApiTokens.get(sbe.id);
      }
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    return client;
  }

  async getVendors(sbe: Sbe) {
    return toGetVendorDto(await this.getAdminApiClient(sbe).get<any, any[]>(`v1/vendors`));
  }
  async getVendor(sbe: Sbe, vendorId: number) {
    return toGetVendorDto(
      await this.getAdminApiClient(sbe).get<any, any>(`v1/vendors/${vendorId}`)
    );
  }
  async putVendor(sbe: Sbe, vendorId: number, vendor: PutVendorDto) {
    vendor.vendorId = vendorId;
    return toGetVendorDto(
      await this.getAdminApiClient(sbe).put<any, any>(`v1/vendors/${vendorId}`, vendor)
    );
  }
  async postVendor(sbe: Sbe, vendor: PostVendorDto) {
    return toGetVendorDto(await this.getAdminApiClient(sbe).post<any, any>(`v1/vendors`, vendor));
  }
  async deleteVendor(sbe: Sbe, vendorId: number) {
    await this.getAdminApiClient(sbe).delete<any, any>(`v1/vendors/${vendorId}`);
    return undefined;
  }
  async getVendorApplications(sbe: Sbe, vendorId: number) {
    return toGetApplicationDto(
      await this.getAdminApiClient(sbe).get<any, any[]>(`v1/vendors/${vendorId}/applications`)
    );
  }

  async getApplications(sbe: Sbe) {
    return toGetApplicationDto(
      await this.getAdminApiClient(sbe).get<any, any[]>(`v1/applications`)
    );
  }
  async getApplication(sbe: Sbe, applicationId: number) {
    return toGetApplicationDto(
      await this.getAdminApiClient(sbe).get<any, any>(`v1/applications/${applicationId}`)
    );
  }
  async putApplication(sbe: Sbe, applicationId: number, application: PutApplicationDto) {
    return toGetApplicationDto(
      await this.getAdminApiClient(sbe).put<any, any>(
        `v1/applications/${applicationId}`,
        application
      )
    );
  }
  async postApplication(sbe: Sbe, application: PostApplicationDto) {
    return this.getAdminApiClient(sbe).post<any, PostApplicationResponseDto>(
      `v1/applications`,
      application
    );
  }
  async deleteApplication(sbe: Sbe, applicationId: number) {
    return this.getAdminApiClient(sbe)
      .delete<any, any>(`v1/applications/${applicationId}`)
      .then(() => undefined);
  }
  async resetApplicationCredentials(sbe: Sbe, applicationId: number) {
    return this.getAdminApiClient(sbe).put<any, any>(
      `v1/applications/${applicationId}/reset-credential`
    );
  }

  async getClaimsets(sbe: Sbe) {
    return toGetClaimsetDto(await this.getAdminApiClient(sbe).get<any, any[]>(`v1/claimsets`));
  }
  async getClaimset(sbe: Sbe, claimsetId: number) {
    return toGetClaimsetDto(
      await this.getAdminApiClient(sbe).get<any, any>(`v1/claimsets/${claimsetId}`)
    );
  }
  async putClaimset(sbe: Sbe, claimsetId: number, claimset: PutClaimsetDto) {
    return toGetClaimsetDto(
      await this.getAdminApiClient(sbe).put<any, any>(`v1/claimsets/${claimsetId}`, claimset)
    );
  }
  async postClaimset(sbe: Sbe, claimset: PostClaimsetDto) {
    return toGetClaimsetDto(
      await this.getAdminApiClient(sbe).post<any, any>(`v1/claimsets`, claimset)
    );
  }
  async deleteClaimset(sbe: Sbe, claimsetId: number) {
    return this.getAdminApiClient(sbe)
      .delete<any, any>(`v1/claimsets/${claimsetId}`)
      .then(() => undefined);
  }
}
