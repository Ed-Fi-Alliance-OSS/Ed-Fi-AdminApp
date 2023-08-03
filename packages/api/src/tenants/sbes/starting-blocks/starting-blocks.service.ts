import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
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
} from '@edanalytics/models';
import { Sbe } from '@edanalytics/models-server';
import { formErrFromValidator } from '@edanalytics/utils';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { ValidationError } from 'class-validator';
import ClientOAuth2 from 'client-oauth2';
import crypto from 'crypto';
import NodeCache from 'node-cache';
import { throwNotFound } from '../../../utils';
import { SbesService } from '../sbes.service';
import { IStartingBlocksService } from './starting-blocks.service.interface';
import { ValidationException } from '../../../utils/ValidationException';
/* eslint @typescript-eslint/no-explicit-any: 0 */ // --> OFF

@Injectable()
export class StartingBlocksService implements IStartingBlocksService {
  adminApiTokens: NodeCache;

  constructor(private readonly sbesService: SbesService) {
    this.adminApiTokens = new NodeCache({ checkperiod: 60 });
  }

  async logIntoAdminApi(sbe: Sbe) {
    if (typeof sbe.configPublic.adminApiUrl !== 'string') {
      throw new Error('No Admin API URL configured.');
    }
    const url = `${sbe.configPublic.adminApiUrl.replace(/\/$/, '')}/connect/token`;
    try {
      new URL(url);
    } catch (InvalidUrl) {
      Logger.log(InvalidUrl);
      throw new Error('Invalid URL');
    }
    const AdminApiAuth = new ClientOAuth2({
      clientId: sbe.configPublic.adminApiKey,
      clientSecret: sbe.configPrivate.adminApiSecret,
      accessTokenUri: `${sbe.configPublic.adminApiUrl.replace(/\/$/, '')}/connect/token`,
      scopes: ['edfi_admin_api/full_access'],
    });

    await AdminApiAuth.credentials
      .getToken()
      .then((v) => {
        this.adminApiTokens.set(sbe.id, v.accessToken, Number(v.data.expires_in) - 60);
      })
      .catch((err) => {
        Logger.log(err);
        throw new Error(err.message);
      });
  }

  async selfRegisterAdminApi(url: string) {
    const ClientId = crypto.randomBytes(12).toString('hex');
    const ClientSecret = crypto.randomBytes(36).toString('hex');
    const DisplayName = `SBAA ${Number(new Date())}ms`;
    const config = {
      ClientId,
      ClientSecret,
      DisplayName,
    };

    const response = await axios
      .post(`${url.replace(/\/$/, '')}/connect/register`, config, {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      })
      .catch((err: AxiosError<any>) => {
        if (err.response?.data?.errors) {
          Logger.warn(JSON.stringify(err.response.data.errors));
        } else if (err?.code === 'ENOTFOUND') {
          Logger.warn('Attempted to register Admin API but ENOTFOUND: ' + url);
          // TODO this should be replaced with a different error handling pattern eventually. Will return failure codes and avoid actual throws until the more outer context-aware scopes.
          const err = new ValidationError();
          err.property = 'adminRegisterUrl';
          err.constraints = {
            server: 'DNS lookup failed for URL provided.',
          };
          err.value = false;
          throw new ValidationException(formErrFromValidator([err]));
        } else {
          Logger.warn(err);
        }
        throw new InternalServerErrorException('Self-registration failed.');
      });
    return config;
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
        try {
          await this.logIntoAdminApi(sbe);
          token = this.adminApiTokens.get(sbe.id);
        } catch (ConnectionError) {
          Logger.error(ConnectionError);
          if (ConnectionError.message === 'No Admin API URL configured.') {
            throw new BadRequestException(
              'Unable to connect to Ed-Fi Admin API. Connection parameters may be misconfigured.'
            );
          }
        }
      }
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    return client;
  }

  private getSbeLambda(sbe: Sbe) {
    const { configPrivate, configPublic } = sbe;
    if (!validate(sbe.configPublic.sbeMetaArn ?? '')) {
      throw new Error('Invalid ARN provided for Starting Blocks metadata function');
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
    return client.send(
      new InvokeCommand({
        FunctionName: sbe.configPublic.sbeMetaArn,
        InvocationType: 'RequestResponse',
      })
    );
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
    return this.getSbeLambda(sbe)
      .then((response) => {
        return JSON.parse(Buffer.from(response.Payload).toString('utf8'));
      })
      .catch((err) => {
        Logger.log(err);
        if (err?.Message) {
          throw new Error(err.Message);
        } else {
          throw err;
        }
      });
  }
}
