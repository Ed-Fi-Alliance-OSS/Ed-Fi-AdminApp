import { Expose } from 'class-transformer';
import { SbV1MetaEdorg, SbV1MetaEnv } from './starting-blocks.v1.dto';
import { IsIn, IsNotEmpty, IsNumberString, IsString } from 'class-validator';
import { TrimWhitespace } from '../utils';
export type SbV2MetaEdorg = SbV1MetaEdorg;

export interface SbV2MetaOds {
  /** odsInstanceId in Admin API */
  id: number;
  /** name in Dynamo DB */
  name: string;
  /** name of database in Postgres */
  dbname: string;
  edorgs?: SbV2MetaEdorg[];
}

export interface SbV2MetaTenant {
  name: string;
  allowedEdorgs: string[];
}

export interface SbV2TenantResourceTree {
  odss?: SbV2MetaOds[];
}

export interface SbV2MetaEnv {
  envlabel: string;
  mode: 'MultiTenant' | 'SingleTenant';
  domainName: string;
  adminApiUrl: string;
  tenantManagementFunctionArn: string;
  tenantResourceTreeFunctionArn: string;
  odsManagementFunctionArn: string;
  edorgManagementFunctionArn: string;
  dataFreshnessFunctionArn: string;
}

export type SbV2MetaSaved = Omit<SbV2MetaEnv, 'tenants' | 'envLabel'>;

export const isSbV2MetaEnv = (obj: SbV2MetaEnv | SbV1MetaEnv): obj is SbV2MetaEnv =>
  'tenantManagementFunctionArn' in obj;

export class RemoveEdorgDtoV2 {
  @Expose()
  @IsString()
  @TrimWhitespace()
  ODSName: string;

  @Expose()
  @IsNumberString()
  EdOrgId: string;
}

export const edorgCategories = ['Local Education Agency', 'State Education Agency'];
export class AddEdorgDtoV2 {
  @Expose()
  @IsString()
  @TrimWhitespace()
  ODSName: string;

  @Expose()
  @IsString()
  @IsIn(edorgCategories)
  @TrimWhitespace()
  EdOrgCategory: string;

  @Expose()
  @IsNumberString()
  EdOrgId: string;

  @Expose()
  @IsString()
  @IsNotEmpty()
  @TrimWhitespace()
  NameOfInstitution: string;
}
