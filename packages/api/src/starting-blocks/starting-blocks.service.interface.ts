import {
  ApplicationResetCredentialResponseDto,
  GetApplicationDto,
  GetClaimsetDto,
  GetVendorDto,
  ITenant,
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

export interface IStartingBlocksService {
  getVendors(
    tenantId: ITenant['id'],
    sbeId: Sbe['id']
  ): Promise<GetVendorDto[]>;
  getVendor(
    tenantId: ITenant['id'],
    sbeId: Sbe['id'],
    vendorId: number
  ): Promise<GetVendorDto>;
  putVendor(
    tenantId: ITenant['id'],
    sbeId: Sbe['id'],
    vendorId: number,
    vendor: PutVendorDto
  ): Promise<GetVendorDto>;
  postVendor(
    tenantId: ITenant['id'],
    sbeId: Sbe['id'],
    vendor: PostVendorDto
  ): Promise<GetVendorDto>;
  deleteVendor(
    tenantId: ITenant['id'],
    sbeId: Sbe['id'],
    vendorId: number
  ): Promise<void>;
  getVendorApplications(
    tenantId: ITenant['id'],
    sbeId: Sbe['id'],
    vendorId: number
  ): Promise<GetApplicationDto[]>;

  getApplications(
    tenantId: ITenant['id'],
    sbeId: Sbe['id']
  ): Promise<GetApplicationDto[]>;
  getApplication(
    tenantId: ITenant['id'],
    sbeId: Sbe['id'],
    applicationId: number
  ): Promise<GetApplicationDto>;
  putApplication(
    tenantId: ITenant['id'],
    sbeId: Sbe['id'],
    applicationId: number,
    application: PutApplicationDto
  ): Promise<GetApplicationDto>;
  postApplication(
    tenantId: ITenant['id'],
    sbeId: Sbe['id'],
    application: PostApplicationDto
  ): Promise<PostApplicationResponseDto>;
  deleteApplication(
    tenantId: ITenant['id'],
    sbeId: Sbe['id'],
    applicationId: number
  ): Promise<void>;
  resetApplicationCredentials(
    tenantId: ITenant['id'],
    sbeId: Sbe['id'],
    applicationId: number
  ): Promise<ApplicationResetCredentialResponseDto>;

  getClaimsets(
    tenantId: ITenant['id'],
    sbeId: Sbe['id']
  ): Promise<GetClaimsetDto[]>;
  getClaimset(
    tenantId: ITenant['id'],
    sbeId: Sbe['id'],
    claimsetId: number
  ): Promise<GetClaimsetDto>;
  putClaimset(
    tenantId: ITenant['id'],
    sbeId: Sbe['id'],
    claimsetId: number,
    claimset: PutClaimsetDto
  ): Promise<GetClaimsetDto>;
  postClaimset(
    tenantId: ITenant['id'],
    sbeId: Sbe['id'],
    claimset: PostClaimsetDto
  ): Promise<GetClaimsetDto>;
  deleteClaimset(
    tenantId: ITenant['id'],
    sbeId: Sbe['id'],
    claimsetId: number
  ): Promise<void>;

  getSbMeta(tenantId: ITenant['id'], sbeId: Sbe['id']): Promise<SbMetaEnv>;
}
