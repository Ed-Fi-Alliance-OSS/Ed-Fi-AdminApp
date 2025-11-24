import { Expose, Type } from 'class-transformer';
import { makeSerializer } from '../utils/make-serializer';
import { GetRoleDto } from './role.dto';
import { GetTeamDto } from './team.dto';
import { GetUserTeamMembershipDto } from './user-tenant-membership.dto';
import { GetUserDto } from './user.dto';
export class GetSessionDataDtoUtm extends GetUserTeamMembershipDto {
  @Expose()
  @Type(() => GetRoleDto)
  role: GetRoleDto | null;
  @Expose()
  @Type(() => GetTeamDto)
  team: GetTeamDto;
}
export class GetSessionDataDto extends GetUserDto {
  @Expose()
  @Type(() => GetSessionDataDtoUtm)
  userTeamMemberships: GetSessionDataDtoUtm[];

  @Expose()
  @Type(() => GetRoleDto)
  role: GetRoleDto;
}

export const toGetSessionDataDto = makeSerializer(GetSessionDataDto);
