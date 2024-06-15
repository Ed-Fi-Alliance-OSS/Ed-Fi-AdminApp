import { Expose, Transform, Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional } from 'class-validator';
import { TrimWhitespace } from '../utils';
import { IRole, ITeam } from '../interfaces';
import { IOwnership, IOwnershipView } from '../interfaces/ownership.interface';
import { DtoGetBase, GetDto } from '../utils/get-base.dto';
import { makeSerializer } from '../utils/make-serializer';
import { DtoPostBase, PostDto } from '../utils/post-base.dto';
import { DtoPutBase, PutDto } from '../utils/put-base.dto';
import { GetEdorgDto } from './edorg.dto';
import { GetOdsDto } from './ods.dto';
import { GetEdfiTenantDto } from './edfi-tenant.dto';
import { GetSbEnvironmentDto } from './sb-environment.dto';

export class GetOwnershipViewDto implements IOwnershipView {
  @Expose()
  id: IOwnership['id'];

  @Expose()
  teamId: ITeam['id'];
  @Expose()
  roleId: IRole['id'] | null;
  @Expose()
  resourceType: 'Edorg' | 'Ods' | 'EdfiTenant' | 'SbEnvironment';
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
    >
{
  @Expose()
  @IsNumber()
  teamId?: ITeam['id'] | undefined;

  @Expose()
  type: 'ods' | 'edorg' | 'edfiTenant' | 'environment';

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

  @IsIn([true], { message: 'You need to select a resource.' })
  get hasResource() {
    return this.type === 'environment'
      ? this.sbEnvironmentId !== undefined
      : this.type === 'edfiTenant'
      ? this.edfiTenantId !== undefined
      : this.type === 'ods'
      ? this.odsId !== undefined
      : this.type === 'edorg'
      ? this.edorgId !== undefined
      : false;
  }
}
