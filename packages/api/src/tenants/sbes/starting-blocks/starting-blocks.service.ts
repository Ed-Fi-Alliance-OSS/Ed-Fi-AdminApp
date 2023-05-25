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
import { Injectable } from '@nestjs/common';
import { aws4Interceptor } from 'aws4-axios';
import axios from 'axios';
import ClientOAuth2 from 'client-oauth2';
import NodeCache from 'node-cache';
import { throwNotFound } from '../../../utils';
import { SbesService } from '../sbes.service';
import { IStartingBlocksService } from './starting-blocks.service.interface';
/* eslint @typescript-eslint/no-explicit-any: 0 */ // --> OFF

@Injectable()
export class StartingBlocksService implements IStartingBlocksService {
  adminApiTokens: NodeCache;

  constructor(private readonly sbesService: SbesService) {
    this.adminApiTokens = new NodeCache({ checkperiod: 60 });
  }

  async logIntoAdminApi(sbe: Sbe) {
    const AdminApiAuth = new ClientOAuth2({
      clientId: sbe.configPrivate.adminApiKey,
      clientSecret: sbe.configPrivate.adminApiSecret,
      accessTokenUri: `${sbe.configPrivate.adminApiUrl.replace(
        /\/$/,
        ''
      )}/connect/token`,
      scopes: ['edfi_admin_api/full_access'],
    });

    await AdminApiAuth.credentials.getToken().then((v) => {
      this.adminApiTokens.set(
        sbe.id,
        v.accessToken,
        Number(v.data.expires_in) - 60
      );
    });
  }

  private getAdminApiClient(sbe: Sbe) {
    const client = axios.create({
      baseURL: sbe.configPrivate.adminApiUrl,
    });
    client.interceptors.response.use((value) => {
      return value.data.result;
    });
    client.interceptors.request.use(async (config) => {
      let token: undefined | string = this.adminApiTokens.get(sbe.id);
      if (token === undefined) {
        await this.logIntoAdminApi(sbe);
        token = this.adminApiTokens.get(sbe.id);
      }
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    return client;
  }

  private getSbeLambdaClient(sbe: Sbe) {
    const { configPrivate } = sbe;
    const client = axios.create();
    client.interceptors.request.use(
      aws4Interceptor({
        instance: client,
        options: {
          region: 'us-east-1',
          service: 'lambda',
        },
        credentials: {
          accessKeyId: configPrivate.sbeMetaKey,
          secretAccessKey: configPrivate.sbeMetaSecret,
        },
      })
    );
    client.interceptors.response.use((response) => {
      return response.data;
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
    const sbe = await this.sbesService.findOne(sbeId);
    return this.getAdminApiClient(sbe).put<any, any>(
      `v1/vendors/${vendorId}`,
      vendor
    );
  }
  async postVendor(sbeId: Sbe['id'], vendor: PostVendorDto) {
    const sbe = await this.sbesService.findOne(sbeId);
    return this.getAdminApiClient(sbe).post<any, any>(`v1/vendors`, vendor);
  }
  async deleteVendor(sbeId: Sbe['id'], vendorId: number) {
    const sbe = await this.sbesService.findOne(sbeId);
    await this.getAdminApiClient(sbe).delete<any, any>(
      `v1/vendors/${vendorId}`
    );
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
    return await this.getAdminApiClient(sbe).get<any, GetApplicationDto[]>(
      `v1/applications`
    );
  }
  async getApplication(sbeId: Sbe['id'], applicationId: number) {
    const sbe = await this.sbesService.findOne(sbeId);
    return await this.getAdminApiClient(sbe).get<any, GetApplicationDto>(
      `v1/applications/${applicationId}`
    );
  }
  async putApplication(
    sbeId: Sbe['id'],
    applicationId: number,
    application: PutApplicationDto
  ) {
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

    await this.getAdminApiClient(sbe).delete<any, any>(
      `v1/applications/${applicationId}`
    );
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
    return this.getAdminApiClient(sbe).get<any, any>(
      `v1/claimsets/${claimsetId}`
    );
  }
  async putClaimset(
    sbeId: Sbe['id'],
    claimsetId: number,
    claimset: PutClaimsetDto
  ) {
    const sbe = await this.sbesService.findOne(sbeId);
    return this.getAdminApiClient(sbe).put<any, any>(
      `v1/claimsets/${claimsetId}`,
      claimset
    );
  }
  async postClaimset(sbeId: Sbe['id'], claimset: PostClaimsetDto) {
    const sbe = await this.sbesService.findOne(sbeId);
    return this.getAdminApiClient(sbe).post<any, any>(`v1/claimsets`, claimset);
  }
  async deleteClaimset(sbeId: Sbe['id'], claimsetId: number) {
    const sbe = await this.sbesService.findOne(sbeId);
    await this.getAdminApiClient(sbe).delete<any, any>(
      `v1/claimsets/${claimsetId}`
    );
    return undefined;
  }
  async getSbMeta(sbeId: Sbe['id']) {
    const sbe = await this.sbesService.findOne(sbeId);
    return this.getSbeLambdaClient(sbe).get<any, any>(
      sbe.configPrivate.sbeMetaUrl
    );
  }
}
