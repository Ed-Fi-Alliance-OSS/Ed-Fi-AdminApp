import { stdDetailed, stdShort } from '@edanalytics/utils';
import { Expose, Type } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { ISbe, ISbeConfigPrivate, ISbeConfigPublic } from '../interfaces/sbe.interface';
import { IsArn } from '../utils';
import { DtoGetBase, GetDto } from '../utils/get-base.dto';
import { makeSerializer } from '../utils/make-serializer';
import { DtoPostBase, PostDto } from '../utils/post-base.dto';
export class GetSbeConfigPublic implements ISbeConfigPublic {
  @Expose()
  edfiHostname?: string;
  @Expose()
  adminApiUrl?: string;
  @Expose()
  adminApiKey?: string;
  @Expose()
  adminApiClientDisplayName?: string | undefined;
  @Expose()
  sbeMetaArn?: string;
  @Expose()
  sbeMetaKey?: string;
  @Expose()
  hasOdsRefresh: false;
  @Expose()
  lastSuccessfulConnectionSbMeta?: Date;
  @Expose()
  lastFailedConnectionSbMeta?: Date;
  @Expose()
  lastSuccessfulConnectionAdminApi?: Date;
  @Expose()
  lastFailedConnectionAdminApi?: Date;
  @Expose()
  lastSuccessfulPull?: Date;
  @Expose()
  lastFailedPull?: Date;

  get lastSuccessfulConnectionSbMetaLong() {
    return stdDetailed(this.lastSuccessfulConnectionSbMeta);
  }
  get lastSuccessfulConnectionSbMetaShort() {
    return stdShort(this.lastSuccessfulConnectionSbMeta);
  }
  get lastFailedConnectionSbMetaLong() {
    return stdDetailed(this.lastFailedConnectionSbMeta);
  }
  get lastFailedConnectionSbMetaShort() {
    return stdShort(this.lastFailedConnectionSbMeta);
  }
  get lastSuccessfulConnectionAdminApiLong() {
    return stdDetailed(this.lastSuccessfulConnectionAdminApi);
  }
  get lastSuccessfulConnectionAdminApiShort() {
    return stdShort(this.lastSuccessfulConnectionAdminApi);
  }
  get lastFailedConnectionAdminApiLong() {
    return stdDetailed(this.lastFailedConnectionAdminApi);
  }
  get lastFailedConnectionAdminApiShort() {
    return stdShort(this.lastFailedConnectionAdminApi);
  }
  get lastSuccessfulPullLong() {
    return stdDetailed(this.lastSuccessfulPull);
  }
  get lastSuccessfulPullShort() {
    return stdShort(this.lastSuccessfulPull);
  }
  get lastFailedPullLong() {
    return stdDetailed(this.lastFailedPull);
  }
  get lastFailedPullShort() {
    return stdShort(this.lastFailedPull);
  }
}

export class SbeConfigPrivate implements ISbeConfigPrivate {
  @Expose()
  adminApiSecret: string;
  @Expose()
  sbeMetaSecret: string;
}

export class GetSbeDto
  extends DtoGetBase
  implements GetDto<ISbe, 'ownerships' | 'odss' | 'edorgs' | 'configPrivate'>
{
  @Expose()
  envLabel: string;
  @Expose()
  @Type(() => GetSbeConfigPublic)
  configPublic: GetSbeConfigPublic;

  override get displayName() {
    return this.envLabel;
  }
}
export const toGetSbeDto = makeSerializer<GetSbeDto, ISbe>(GetSbeDto);

export class PutSbeAdminApiRegister {
  modifiedById?: number | undefined;
  id: number;

  @IsString()
  @Expose()
  adminRegisterUrl?: string;
}
export class PutSbeAdminApi {
  modifiedById?: number | undefined;
  id: number;

  @IsString()
  @IsOptional()
  @Expose()
  adminUrl?: string;

  @IsString()
  @IsOptional()
  @Expose()
  adminKey?: string;

  @IsString()
  @IsOptional()
  @Expose()
  adminSecret?: string;
}
export class PutSbeMeta {
  modifiedById?: number | undefined;
  id: number;

  @IsString()
  @IsOptional()
  @IsArn()
  @Expose()
  arn?: string;

  @IsString()
  @IsOptional()
  @Expose()
  metaKey?: string;

  @IsString()
  @IsOptional()
  @Expose()
  metaSecret?: string;
}

export class PostSbeDto
  extends DtoPostBase
  implements PostDto<ISbe, 'ownerships' | 'odss' | 'edorgs' | 'configPrivate' | 'configPublic'>
{
  @Expose()
  @MinLength(3)
  envLabel: string;
}

export class SbeCheckConnectionDto {
  @Expose()
  id: number;

  @Expose()
  adminApi: boolean;

  @Expose()
  sbMeta: boolean;

  @Expose()
  messages: string[];
}
export const toSbeCCDto = makeSerializer(SbeCheckConnectionDto);

export class SbeRefreshResourcesDto {
  @Expose()
  id: number;

  @Expose()
  odsCount: number;

  @Expose()
  edorgCount: number;
}
export const toSbeRRDto = makeSerializer(SbeRefreshResourcesDto);
