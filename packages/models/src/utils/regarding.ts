import {
  GetOdsDto,
  GetEdfiTenantDto,
  GetEdorgDto,
  GetUserTeamMembershipDto,
  GetUserDto,
  GetTeamDto,
  GetRoleDto,
  GetOwnershipDto,
  GetSbEnvironmentDto,
} from '../dtos';

export const entityNamesMap = {
  Ods: 'ODS',
  GetOdsDto: 'ODS',
  EdfiTenant: 'EdFi Tenant',
  GetEdfiTenantDto: 'EdFi Tenant',
  SbEnvironment: 'Environment',
  GetSbEnvironmentDto: 'Environment',
  Edorg: 'Ed-Org',
  GetEdorgDto: 'Ed-Org',
  UserTeamMembership: 'Team membership',
  GetUserTeamMembershipDto: 'Team membership',
  User: 'User',
  GetUserDto: 'User',
  Team: 'Team',
  GetTeamDto: 'Team',
  Privilege: 'Privilege',
  Role: 'Role',
  GetRoleDto: 'Role',
  Ownership: 'Resource ownership',
  GetOwnershipDto: 'Resource ownership',
};

export const regarding = (
  entity:
    | GetOdsDto
    | GetEdfiTenantDto
    | GetSbEnvironmentDto
    | GetEdorgDto
    | GetUserTeamMembershipDto
    | GetUserDto
    | GetTeamDto
    | GetRoleDto
    | GetOwnershipDto
) => {
  const name = entity.constructor.name;
  return `${entity.displayName} (${entityNamesMap[name as keyof typeof entityNamesMap]})`;
};
