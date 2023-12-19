import { Expose, Transform, Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional } from 'class-validator';
import { IRole, ITenant } from '../interfaces';
import { IOwnership } from '../interfaces/ownership.interface';
import { DtoGetBase, GetDto } from '../utils/get-base.dto';
import { makeSerializer } from '../utils/make-serializer';
import { DtoPostBase, PostDto } from '../utils/post-base.dto';
import { DtoPutBase, PutDto } from '../utils/put-base.dto';
import { GetEdorgDto } from './edorg.dto';
import { GetOdsDto } from './ods.dto';
import { GetSbeDto } from './sbe.dto';

export class GetOwnershipDto
  extends DtoGetBase
  implements
    GetDto<IOwnership, 'tenant' | 'role' | 'sbeId' | 'sbe' | 'odsId' | 'ods' | 'edorgId' | 'edorg'>
{
  @Expose()
  tenantId: ITenant['id'];
  @Expose()
  roleId: IRole['id'] | null;

  @Expose()
  @Type(() => GetSbeDto)
  sbe?: GetSbeDto;

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
      'tenant' | 'tenantId' | 'role' | 'sbeId' | 'sbe' | 'odsId' | 'ods' | 'edorgId' | 'edorg'
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
      | 'tenant'
      | 'role'
      | 'sbeId'
      | 'sbe'
      | 'odsId'
      | 'ods'
      | 'edorgId'
      | 'edorg'
      | 'tenantId'
      | 'roleId'
    >
{
  @Expose()
  @IsNumber()
  tenantId?: ITenant['id'] | undefined;

  @Expose()
  type: 'ods' | 'edorg' | 'sbe';

  @Expose()
  @IsNumber()
  @IsOptional()
  roleId?: IRole['id'] | undefined;

  @Expose()
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (typeof value === 'number' ? value : undefined))
  sbeId?: GetSbeDto['id'];

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
    return this.type === 'sbe'
      ? this.sbeId !== undefined
      : this.type === 'ods'
      ? this.odsId !== undefined
      : this.type === 'edorg'
      ? this.edorgId !== undefined
      : false;
  }
}
