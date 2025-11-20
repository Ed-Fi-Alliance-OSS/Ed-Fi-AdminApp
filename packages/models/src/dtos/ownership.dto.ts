import { Expose, Transform, Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional } from 'class-validator';
import { OWNERSHIP_RESOURCE_TYPE } from '../interfaces';
import type {
  IRole,
  ITeam,
  IOwnership,
  IOwnershipView,
  OwnershipResourceType,
} from '../interfaces';
import { DtoGetBase, GetDto } from '../utils/get-base.dto';
import { makeSerializer } from '../utils/make-serializer';
import { DtoPostBase, PostDto } from '../utils/post-base.dto';
import { DtoPutBase, PutDto } from '../utils/put-base.dto';
import { GetEdorgDto } from './edorg.dto';
import { GetOdsDto } from './ods.dto';
import { GetEdfiTenantDto } from './edfi-tenant.dto';
import { GetSbEnvironmentDto } from './sb-environment.dto';
import { GetIntegrationProviderDto } from './integration-provider.dto';

export class GetOwnershipViewDto implements IOwnershipView {
  @Expose()
  id: IOwnership['id'];

  @Expose()
  teamId: ITeam['id'];
  @Expose()
  roleId: IRole['id'] | null;
  @Expose()
  resourceType: OwnershipResourceType;
  @Expose()
  resourceText: string;

  get displayName() {
    return 'Resource ownership';
  }
}

export const toGetOwnershipViewDto = makeSerializer(GetOwnershipViewDto);
export class GetOwnershipDto
  extends DtoGetBase
  implements
    GetDto<
      IOwnership,
      | 'team'
      | 'role'
      | 'sbEnvironmentId'
      | 'sbEnvironment'
      | 'edfiTenantId'
      | 'edfiTenant'
      | 'odsId'
      | 'ods'
      | 'edorgId'
      | 'edorg'
      | 'integrationProviderId'
      | 'integrationProvider'
    >
{
  @Expose()
  teamId: ITeam['id'];
  @Expose()
  roleId: IRole['id'] | null;

  @Expose()
  @Type(() => GetSbEnvironmentDto)
  sbEnvironment?: GetSbEnvironmentDto;

  @Expose()
  @Type(() => GetEdfiTenantDto)
  edfiTenant?: GetEdfiTenantDto;

  @Expose()
  @Type(() => GetOdsDto)
  ods?: GetOdsDto;

  @Expose()
  @Type(() => GetEdorgDto)
  edorg?: GetEdorgDto;

  @Expose()
  @Type(() => GetIntegrationProviderDto)
  integrationProvider?: GetIntegrationProviderDto;

  override get displayName() {
    return 'Resource ownership';
  }
}
export const toGetOwnershipDto = makeSerializer<GetOwnershipDto, IOwnership>(GetOwnershipDto);

export class PutOwnershipDto
  extends DtoPutBase
  implements
    PutDto<
      IOwnership,
      | 'team'
      | 'teamId'
      | 'role'
      | 'edfiTenantId'
      | 'edfiTenant'
      | 'odsId'
      | 'ods'
      | 'edorgId'
      | 'edorg'
      | 'integrationProviderId'
      | 'integrationProvider'
    >
{
  @Expose()
  @IsOptional()
  @IsNumber()
  roleId: IRole['id'];
}

export class PostOwnershipDto
  extends DtoPostBase
  implements
    PostDto<
      IOwnership,
      | 'team'
      | 'role'
      | 'edfiTenantId'
      | 'edfiTenant'
      | 'odsId'
      | 'ods'
      | 'edorgId'
      | 'edorg'
      | 'teamId'
      | 'roleId'
      | 'integrationProviderId'
    >
{
  @Expose()
  @IsNumber()
  teamId?: ITeam['id'] | undefined;

  @Expose()
  type: OwnershipResourceType;

  @Expose()
  @IsNumber()
  @IsOptional()
  roleId?: IRole['id'] | undefined;

  @Expose()
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (typeof value === 'number' ? value : undefined))
  sbEnvironmentId?: GetSbEnvironmentDto['id'];

  @Expose()
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (typeof value === 'number' ? value : undefined))
  edfiTenantId?: GetEdfiTenantDto['id'];

  @Expose()
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (typeof value === 'number' ? value : undefined))
  odsId?: GetOdsDto['id'];

  @Expose()
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (typeof value === 'number' ? value : undefined))
  edorgId?: GetEdorgDto['id'];

  @Expose()
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (typeof value === 'number' ? value : undefined))
  integrationProviderId?: GetIntegrationProviderDto['id'];

  @IsIn([true], { message: 'You need to select a resource.' })
  get hasResource() {
    return this.type === OWNERSHIP_RESOURCE_TYPE.sbEnvironment
      ? this.sbEnvironmentId !== undefined
      : this.type === OWNERSHIP_RESOURCE_TYPE.edfiTenant
      ? this.edfiTenantId !== undefined
      : this.type === OWNERSHIP_RESOURCE_TYPE.ods
      ? this.odsId !== undefined
      : this.type === OWNERSHIP_RESOURCE_TYPE.edorg
      ? this.edorgId !== undefined
      : this.type === OWNERSHIP_RESOURCE_TYPE.integrationProvider
      ? this.integrationProviderId !== undefined
      : false;
  }
}
