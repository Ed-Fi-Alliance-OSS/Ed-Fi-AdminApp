import {
  GetApplicationDto,
  PostApplicationDto,
  PostClaimsetDto,
  PostVendorDto,
  PutApplicationDto,
  PutClaimsetDto,
  PutVendorDto,
} from '@edanalytics/models';
import {
  Edorg,
  Ods,
  Ownership,
  Role,
  Sbe,
  UserTenantMembership,
} from '@edanalytics/models-server';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { aws4Interceptor } from 'aws4-axios';
import axios from 'axios';
import ClientOAuth2 from 'client-oauth2';
import NodeCache from 'node-cache';
import { Repository } from 'typeorm';
import { EdorgsService } from '../edorgs/edorgs.service';
import { OdssService } from '../odss/odss.service';
import { SbesService } from '../sbes/sbes.service';
import { IStartingBlocksService } from './starting-blocks.service.interface';
/* eslint @typescript-eslint/no-explicit-any: 0 */ // --> OFF

@Injectable()
export class StartingBlocksService implements IStartingBlocksService {
  adminApiTokens: NodeCache;

  constructor(
    private readonly sbesService: SbesService,
    private readonly odssService: OdssService,
    private readonly edorgsService: EdorgsService,
    @InjectRepository(Sbe)
    private sbesRepository: Repository<Sbe>,
    @InjectRepository(Ods)
    private odsRepository: Repository<Ods>,
    @InjectRepository(Edorg)
    private edorgRepository: Repository<Edorg>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(UserTenantMembership)
    private utmRepository: Repository<UserTenantMembership>,
    @InjectRepository(Ownership)
    private ownershipRepository: Repository<Ownership>
  ) {
    this.adminApiTokens = new NodeCache({ checkperiod: 60 });
  }

  private async logIntoAdminApi(sbe: Sbe) {
    const AdminApiAuth = new ClientOAuth2({
      clientId: sbe.configPrivate.adminApiKey,
      clientSecret: sbe.configPrivate.adminApiSecret,
      accessTokenUri: `${sbe.configPrivate.adminApiUrl}/connect/token`,
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

  async getVendors(tenantId: number, sbeId: Sbe['id']) {
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    return this.getAdminApiClient(sbe).get<any, any>(`v1/vendors`);
  }
  async getVendor(tenantId: number, sbeId: Sbe['id'], vendorId: number) {
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    return this.getAdminApiClient(sbe).get<any, any>(`v1/vendors/${vendorId}`);
  }
  async putVendor(
    tenantId: number,
    sbeId: Sbe['id'],
    vendorId: number,
    vendor: PutVendorDto
  ) {
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    return this.getAdminApiClient(sbe).put<any, any>(
      `v1/vendors/${vendorId}`,
      vendor
    );
  }
  async postVendor(tenantId: number, sbeId: Sbe['id'], vendor: PostVendorDto) {
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    return this.getAdminApiClient(sbe).post<any, any>(`v1/vendors`, vendor);
  }
  async deleteVendor(tenantId: number, sbeId: Sbe['id'], vendorId: number) {
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    await this.getAdminApiClient(sbe).delete<any, any>(
      `v1/vendors/${vendorId}`
    );
    return undefined;
  }
  async getVendorApplications(
    tenantId: number,
    sbeId: Sbe['id'],
    vendorId: number
  ) {
    const edorgIds = new Set(
      (await this.edorgsService.getTenantEdorgs(tenantId, sbeId)).map(
        (edorg) => edorg.educationOrganizationId
      )
    );
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    const allApplications = await this.getAdminApiClient(sbe).get<
      any,
      GetApplicationDto[]
    >(`v1/vendors/${vendorId}/applications`);
    return allApplications.filter((app) =>
      edorgIds.has(String(app.educationOrganizationId))
    );
  }

  async getApplications(tenantId: number, sbeId: Sbe['id']) {
    const edorgIds = new Set(
      (await this.edorgsService.getTenantEdorgs(tenantId, sbeId)).map(
        (edorg) => edorg.educationOrganizationId
      )
    );
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    const allApplications = await this.getAdminApiClient(sbe).get<
      any,
      GetApplicationDto[]
    >(`v1/applications`);
    return allApplications.filter((app) =>
      edorgIds.has(String(app.educationOrganizationId))
    );
  }
  async getApplication(
    tenantId: number,
    sbeId: Sbe['id'],
    applicationId: number
  ) {
    const edorgIds = new Set(
      (await this.edorgsService.getTenantEdorgs(tenantId, sbeId)).map(
        (edorg) => edorg.educationOrganizationId
      )
    );
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    const application = await this.getAdminApiClient(sbe).get<
      any,
      GetApplicationDto
    >(`v1/applications/${applicationId}`);
    if (!edorgIds.has(String(application.educationOrganizationId)))
      throw new NotFoundException();
    return application;
  }
  async putApplication(
    tenantId: number,
    sbeId: Sbe['id'],
    applicationId: number,
    application: PutApplicationDto
  ) {
    const edorgIds = new Set(
      (await this.edorgsService.getTenantEdorgs(tenantId, sbeId)).map(
        (edorg) => edorg.educationOrganizationId
      )
    );
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    const existingApplication = await this.getAdminApiClient(sbe).get<
      any,
      GetApplicationDto
    >(`v1/applications/${applicationId}`);
    if (!edorgIds.has(String(existingApplication.educationOrganizationId)))
      throw new NotFoundException();

    return this.getAdminApiClient(sbe).put<any, any>(
      `v1/applications/${applicationId}`,
      application
    );
  }
  async postApplication(
    tenantId: number,
    sbeId: Sbe['id'],
    application: PostApplicationDto
  ) {
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    return this.getAdminApiClient(sbe).post<any, any>(
      `v1/applications`,
      application
    );
  }
  async deleteApplication(
    tenantId: number,
    sbeId: Sbe['id'],
    applicationId: number
  ) {
    const edorgIds = new Set(
      (await this.edorgsService.getTenantEdorgs(tenantId, sbeId)).map(
        (edorg) => edorg.educationOrganizationId
      )
    );
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    const existingApplication = await this.getAdminApiClient(sbe).get<
      any,
      GetApplicationDto
    >(`v1/applications/${applicationId}`);
    if (!edorgIds.has(String(existingApplication.educationOrganizationId)))
      throw new NotFoundException();

    await this.getAdminApiClient(sbe).delete<any, any>(
      `v1/applications/${applicationId}`
    );
    return undefined;
  }
  async resetApplicationCredentials(
    tenantId: number,
    sbeId: Sbe['id'],
    applicationId: number
  ) {
    const edorgIds = new Set(
      (await this.edorgsService.getTenantEdorgs(tenantId, sbeId)).map(
        (edorg) => edorg.educationOrganizationId
      )
    );
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    const existingApplication = await this.getAdminApiClient(sbe).get<
      any,
      GetApplicationDto
    >(`v1/applications/${applicationId}`);
    if (!edorgIds.has(String(existingApplication.educationOrganizationId)))
      throw new NotFoundException();

    return this.getAdminApiClient(sbe).put<any, any>(
      `v1/applications/${applicationId}/reset-credential`
    );
  }

  async getClaimsets(tenantId: number, sbeId: Sbe['id']) {
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    return this.getAdminApiClient(sbe).get<any, any>(`v1/claimsets`);
  }
  async getClaimset(tenantId: number, sbeId: Sbe['id'], claimsetId: number) {
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    return this.getAdminApiClient(sbe).get<any, any>(
      `v1/claimsets/${claimsetId}`
    );
  }
  async putClaimset(
    tenantId: number,
    sbeId: Sbe['id'],
    claimsetId: number,
    claimset: PutClaimsetDto
  ) {
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    return this.getAdminApiClient(sbe).put<any, any>(
      `v1/claimsets/${claimsetId}`,
      claimset
    );
  }
  async postClaimset(
    tenantId: number,
    sbeId: Sbe['id'],
    claimset: PostClaimsetDto
  ) {
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    return this.getAdminApiClient(sbe).post<any, any>(`v1/claimsets`, claimset);
  }
  async deleteClaimset(tenantId: number, sbeId: Sbe['id'], claimsetId: number) {
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    await this.getAdminApiClient(sbe).delete<any, any>(
      `v1/claimsets/${claimsetId}`
    );
    return undefined;
  }
  async getSbMeta(tenantId: number, sbeId: Sbe['id']) {
    const sbe = await this.sbesService.findOne(tenantId, sbeId);
    return this.getSbeLambdaClient(sbe).get<any, any>(
      sbe.configPrivate.sbeMetaUrl
    );
  }
}
