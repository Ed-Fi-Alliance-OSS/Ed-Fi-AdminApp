import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { TrimWhitespace } from '../utils';
import { RoleType } from '../enums';
import { ITeam } from '../interfaces';
import { IRole } from '../interfaces/role.interface';
import { PRIVILEGES, PrivilegeCode, PRIVILEGE_CODES } from '../types';
import { IsValidPrivileges } from '../utils';
import { DtoGetBase, GetDto } from '../utils/get-base.dto';
import { makeSerializer } from '../utils/make-serializer';
import { DtoPostBase, PostDto } from '../utils/post-base.dto';
import { DtoPutBase, PutDto } from '../utils/put-base.dto';

export class GetRoleDto extends DtoGetBase implements GetDto<IRole, 'team'> {
  @Expose()
  name: string;
  @Expose()
  description?: string;
  @Expose()
  @Transform(({ value }) => (value === null ? undefined : value))
  teamId?: ITeam['id'];
  @Expose()
  type: RoleType;
  @Expose()
  privilegeIds: PrivilegeCode[];

  get privileges() {
    return this.privilegeIds.map((code) => PRIVILEGES[code]);
  }

  override get displayName() {
    return this.name;
  }
}
export const toGetRoleDto = makeSerializer<GetRoleDto, IRole>(GetRoleDto);

export class PutRoleDto
  extends DtoPutBase
  implements PutDto<IRole, 'team' | 'type' | 'teamId' | 'privileges'>
{
  @Expose()
  @IsString()
  @MinLength(3)
  @TrimWhitespace()
  name: string;

  @Expose()
  @IsOptional()
  @IsString()
  @TrimWhitespace()
  description?: string;

  @Expose()
  @IsIn(PRIVILEGE_CODES, { each: true })
  @IsValidPrivileges()
  privilegeIds: PrivilegeCode[];
}

export class PostRoleDto extends DtoPostBase implements PostDto<IRole, 'team' | 'privileges'> {
  @Expose()
  @IsOptional()
  @IsNumber()
  teamId?: ITeam['id'];

  @Expose()
  @IsEnum(RoleType)
  type: RoleType;

  @Expose()
  @IsString()
  @MinLength(3)
  @TrimWhitespace()
  name: string;

  @Expose()
  @IsOptional()
  @IsString()
  @TrimWhitespace()
  description?: string;

  @Expose()
  @IsIn(PRIVILEGE_CODES, { each: true })
  @IsValidPrivileges()
  privilegeIds: PrivilegeCode[];
}
