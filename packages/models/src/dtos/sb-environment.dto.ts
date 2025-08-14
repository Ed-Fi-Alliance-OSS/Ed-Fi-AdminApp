import { Expose, Type } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength, IsIn } from 'class-validator';
import { TrimWhitespace } from '../utils';
import type {
  ISbEnvironment,
  SbEnvironmentConfigPublic,
} from '../interfaces/sb-environment.interface';
import { DtoPutBase, IsArn, PutDto } from '../utils';
import { DtoGetBase, GetDto } from '../utils/get-base.dto';
import { makeSerializer } from '../utils/make-serializer';
import { DtoPostBase, PostDto } from '../utils/post-base.dto';
import { GetEdfiTenantDto } from './edfi-tenant.dto';
import { SbSyncQueueDto } from './sb-sync-queue.dto';

export class GetSbEnvironmentDto
  extends DtoGetBase
  implements
    GetDto<
      ISbEnvironment,
      | 'ownerships'
      | 'odss'
      | 'edorgs'
      | 'configPrivate'
      | 'edfiTenants'
      | 'adminApiUrl'
      | 'integrationApps'
    >
{
  @Expose()
  envLabel: string;

  @Expose()
  //// TODO this is 100% not *necessary*, but might be a good idea at least in v7 environments where users don't have a need to know the keys.
  // @Transform(({ value, type }) => {
  //   // API keys are *not* secret (API secrets are separate), but still want to mask for extra obscurity
  //   if (type === TransformationType.CLASS_TO_PLAIN) {
  //     // v1
  //     if (value?.values?.adminApiKey) {
  //       value.values.adminApiKey = '********';
  //     }
  //     // v2
  //     const tenantNames = Object.keys(value?.values?.tenants || {});
  //     tenantNames.forEach((name) => {
  //       if (value.values.tenants[name].adminApiKey) {
  //         value.values.tenants[name].adminApiKey = '********';
  //       }
  //     });
  //   }
  //   return value;
  // })
  configPublic: SbEnvironmentConfigPublic;

  @Expose()
  @Type(() => GetEdfiTenantDto)
  edfiTenants: GetEdfiTenantDto[];

  @Expose()
  name: string;

  override get displayName() {
    return this.name;
  }

  get version() {
    return this.configPublic && 'version' in this.configPublic
      ? this.configPublic.version
      : undefined;
  }

  get domain() {
    let host =
      this.configPublic && 'values' in this.configPublic && this.configPublic.values
        ? 'edfiHostname' in this.configPublic.values
          ? this.configPublic.values.edfiHostname
          : this.configPublic?.values?.meta?.domainName
        : undefined;
    if (host && !(host.startsWith('http://') || host.startsWith('https://'))) {
      host = `https://${host}`;
    }
    return host;
  }

  /** SB routing rules require an extra subdomain to identify applications. Sbaa uses `sbaa.`. */
  get usableDomain() {
    return this.domain?.replace(/(https?:\/\/)/, '$1sbaa.');
  }

  get odsApiVersion() {
    return this.configPublic?.odsApiMeta?.version;
  }

  get odsDsVersion() {
    return this.configPublic?.odsApiMeta?.dataModels.find((dm) => dm.name === 'Ed-Fi')?.version;
  }

  get adminApiUrl() {
    const configPublic = this.configPublic;
    if (configPublic?.adminApiUrl) {
      return new URL(configPublic.adminApiUrl).toString();
    } else {
      return undefined;
    }
  }
}
export const toGetSbEnvironmentDto = makeSerializer<GetSbEnvironmentDto, ISbEnvironment>(
  GetSbEnvironmentDto
);

export class PutSbEnvironmentMeta {
  modifiedById?: number | undefined;
  id: number;

  @IsString()
  @IsOptional()
  @IsArn()
  @Expose()
  @TrimWhitespace()
  arn?: string;
}

export class PostSbEnvironmentDto
  extends DtoPostBase
  implements
    PostDto<
      ISbEnvironment,
      | 'ownerships'
      | 'envLabel'
      | 'odss'
      | 'edorgs'
      | 'configPrivate'
      | 'configPublic'
      | 'edfiTenants'
      | 'version'
      | 'domain'
      | 'adminApiUrl'
      | 'usableDomain'
      | 'odsApiVersion'
      | 'odsDsVersion'
      | 'name'
      | 'integrationApps'
    >
{
  @Expose()
  @MinLength(3)
  @TrimWhitespace()
  name: string;

  @Expose()
  @MaxLength(2)
  @IsIn(['v1', 'v2'])
  version?: 'v1' | 'v2';

  @Expose()
  @MinLength(3)
  @TrimWhitespace()
  @Matches(/^(https?:\/\/)[^\s$.?#].[^\s]*$/i, {
    message: 'ODS/API Discovery URL must be a valid URL starting with http:// or https://',
  })
  odsApiDiscoveryUrl?: string;

  @Expose()
  @MinLength(3)
  @TrimWhitespace()
  @Matches(/^(https?:\/\/)[^\s$.?#].[^\s]*$/i, {
    message: 'Admin API URL must be a valid URL starting with http:// or https://',
  })
  adminApiUrl?: string;

  @Expose()
  @MinLength(3)
  @TrimWhitespace()
  environmentLabel?: string;

  @Expose()
  isMultitenant?: boolean;

  @Expose()
  startingBlocks: boolean;

  @Expose()
  @IsString()
  @Matches(/^\s*\d+\s*(\s*,\s*\d+\s*)*$/, {
    message: 'Must be a single number or a comma-separated list of numbers',
  })
  @TrimWhitespace()
  edOrgIds?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @IsArn({ allowEmptyString: true })
  @TrimWhitespace()
  metaArn?: string | undefined;

  @Expose()
  configPublic?: SbEnvironmentConfigPublic;
}

export class PostSbEnvironmentResponseDto {
  @Expose()
  id: number;

  @Expose()
  @Type(() => SbSyncQueueDto)
  syncQueue?: SbSyncQueueDto;
}

export const toPostSbEnvironmentResponseDto = makeSerializer(PostSbEnvironmentResponseDto);
export class PutSbEnvironmentDto
  extends DtoPutBase
  implements
    PutDto<
      ISbEnvironment,
      | 'ownerships'
      | 'envLabel'
      | 'odss'
      | 'edorgs'
      | 'configPrivate'
      | 'configPublic'
      | 'edfiTenants'
      | 'version'
      | 'domain'
      | 'usableDomain'
      | 'odsApiVersion'
      | 'odsDsVersion'
      | 'adminApiUrl'
      | 'integrationApps'
    >
{
  @Expose()
  @MinLength(3)
  @TrimWhitespace()
  name: string;
}
