import { InvokeCommand, LambdaClient, LambdaServiceException } from '@aws-sdk/client-lambda';
import { parse, validate } from '@aws-sdk/util-arn-parser';
import {
  GetApplicationDto,
  PostApplicationDto,
  PostApplicationResponseDto,
  PostClaimsetDto,
  PostVendorDto,
  PutApplicationDto,
  PutClaimsetDto,
  PutVendorDto,
  SbMetaEnv,
} from '@edanalytics/models';
import { Sbe } from '@edanalytics/models-server';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import ClientOAuth2 from 'client-oauth2';
import crypto from 'crypto';
import NodeCache from 'node-cache';
import { throwNotFound } from '../../../utils';
import { SbesService } from '../sbes.service';
/* eslint @typescript-eslint/no-explicit-any: 0 */ // --> OFF

@Injectable()
export class StartingBlocksService {
  adminApiTokens: NodeCache;

  constructor(private readonly sbesService: SbesService) {
    this.adminApiTokens = new NodeCache({ checkperiod: 60 });
  }

  async logIntoAdminApi(sbe: Sbe) {
    if (typeof sbe.configPublic.adminApiUrl !== 'string') {
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
      Logger.log(LoginFailed);
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
    client.interceptors.response.use((value) => {
      return value.data.result;
    });
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
          throw new BadRequestException(adminApiLoginFailureMessages[adminLogin.status]);
        }
        token = this.adminApiTokens.get(sbe.id);
      }
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    return client;
  }

  async getVendors(sbeId: Sbe['id']) {
    const sbe = await this.sbesService.findOne(sbeId);
    return this.getAdminApiClient(sbe).get<any, any>(`v1/vendors`);
  }
  async getVendor(sbeId: Sbe['id'], vendorId: number) {
    const sbe = await this.sbesService.findOne(sbeId);
    return this.getAdminApiClient(sbe).get<any, any>(`v1/vendors/${vendorId}`);
  }
  async putVendor(sbeId: Sbe['id'], vendorId: number, vendor: PutVendorDto) {
    vendor.vendorId = vendorId;
    const sbe = await this.sbesService.findOne(sbeId);
    return this.getAdminApiClient(sbe).put<any, any>(`v1/vendors/${vendorId}`, vendor);
  }
  async postVendor(sbeId: Sbe['id'], vendor: PostVendorDto) {
    const sbe = await this.sbesService.findOne(sbeId);
    return this.getAdminApiClient(sbe).post<any, any>(`v1/vendors`, vendor);
  }
  async deleteVendor(sbeId: Sbe['id'], vendorId: number) {
    const sbe = await this.sbesService.findOne(sbeId);
    await this.getAdminApiClient(sbe).delete<any, any>(`v1/vendors/${vendorId}`);
    return undefined;
  }
  async getVendorApplications(sbeId: Sbe['id'], vendorId: number) {
    const sbe = await this.sbesService.findOne(sbeId);
    return await this.getAdminApiClient(sbe).get<any, GetApplicationDto[]>(
      `v1/vendors/${vendorId}/applications`
    );
  }

  async getApplications(sbeId: Sbe['id']) {
    const sbe = await this.sbesService.findOne(sbeId);
    return await this.getAdminApiClient(sbe).get<any, GetApplicationDto[]>(`v1/applications`);
  }
  async getApplication(sbeId: Sbe['id'], applicationId: number) {
    const sbe = await this.sbesService.findOne(sbeId);
    return await this.getAdminApiClient(sbe).get<any, GetApplicationDto>(
      `v1/applications/${applicationId}`
    );
  }
  async putApplication(sbeId: Sbe['id'], applicationId: number, application: PutApplicationDto) {
    const sbe = await this.sbesService.findOne(sbeId);
    await this.getAdminApiClient(sbe)
      .get<any, GetApplicationDto>(`v1/applications/${applicationId}`)
      .catch(throwNotFound);

    return this.getAdminApiClient(sbe).put<any, any>(
      `v1/applications/${applicationId}`,
      application
    );
  }
  async postApplication(sbeId: Sbe['id'], application: PostApplicationDto) {
    const sbe = await this.sbesService.findOne(sbeId);
    return this.getAdminApiClient(sbe).post<any, PostApplicationResponseDto>(
      `v1/applications`,
      application
    );
  }
  async deleteApplication(sbeId: Sbe['id'], applicationId: number) {
    const sbe = await this.sbesService.findOne(sbeId);
    await this.getAdminApiClient(sbe)
      .get<any, GetApplicationDto>(`v1/applications/${applicationId}`)
      .catch(throwNotFound);

    await this.getAdminApiClient(sbe).delete<any, any>(`v1/applications/${applicationId}`);
    return undefined;
  }
  async resetApplicationCredentials(sbeId: Sbe['id'], applicationId: number) {
    const sbe = await this.sbesService.findOne(sbeId);
    await this.getAdminApiClient(sbe)
      .get<any, GetApplicationDto>(`v1/applications/${applicationId}`)
      .catch(throwNotFound);

    return this.getAdminApiClient(sbe).put<any, any>(
      `v1/applications/${applicationId}/reset-credential`
    );
  }

  async getClaimsets(sbeId: Sbe['id']) {
    const sbe = await this.sbesService.findOne(sbeId);
    return this.getAdminApiClient(sbe).get<any, any>(`v1/claimsets`);
  }
  async getClaimset(sbeId: Sbe['id'], claimsetId: number) {
    const sbe = await this.sbesService.findOne(sbeId);
    return this.getAdminApiClient(sbe).get<any, any>(`v1/claimsets/${claimsetId}`);
  }
  async putClaimset(sbeId: Sbe['id'], claimsetId: number, claimset: PutClaimsetDto) {
    const sbe = await this.sbesService.findOne(sbeId);
    return this.getAdminApiClient(sbe).put<any, any>(`v1/claimsets/${claimsetId}`, claimset);
  }
  async postClaimset(sbeId: Sbe['id'], claimset: PostClaimsetDto) {
    const sbe = await this.sbesService.findOne(sbeId);
    return this.getAdminApiClient(sbe).post<any, any>(`v1/claimsets`, claimset);
  }
  async deleteClaimset(sbeId: Sbe['id'], claimsetId: number) {
    const sbe = await this.sbesService.findOne(sbeId);
    await this.getAdminApiClient(sbe).delete<any, any>(`v1/claimsets/${claimsetId}`);
    return undefined;
  }
  async getSbMeta(sbeId: Sbe['id']) {
    const sbe = await this.sbesService.findOne(sbeId);
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
    } catch (LambdaError: LambdaServiceException | any) {
      return {
        status: 'FAILURE' as const,
        error: LambdaError.message
          ? (LambdaError.message as string)
          : 'Failed to execute SB Lambda',
      };
    }
  }
}
