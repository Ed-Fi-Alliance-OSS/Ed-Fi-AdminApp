import {
  GetOdsDto,
  GetSbeDto,
  GetEdorgDto,
  GetUserTenantMembershipDto,
  GetUserDto,
  GetTenantDto,
  GetPrivilegeDto,
  GetRoleDto,
  GetOwnershipDto,
} from '../dtos';

export const entityNamesMap = {
  Ods: 'ODS',
  GetOdsDto: 'ODS',
  Sbe: 'Environment',
  GetSbeDto: 'Environment',
  Edorg: 'Ed-Org',
  GetEdorgDto: 'Ed-Org',
  UserTenantMembership: 'Tenant membership',
  GetUserTenantMembershipDto: 'Tenant membership',
  User: 'User',
  GetUserDto: 'User',
  Tenant: 'Tenant',
  GetTenantDto: 'Tenant',
  Privilege: 'Privilege',
  GetPrivilegeDto: 'Privilege',
  Role: 'Role',
  GetRoleDto: 'Role',
  Ownership: 'Resource ownership',
  GetOwnershipDto: 'Resource ownership',
};

export const regarding = (
  entity:
    | GetOdsDto
    | GetSbeDto
    | GetEdorgDto
    | GetUserTenantMembershipDto
    | GetUserDto
    | GetTenantDto
    | GetPrivilegeDto
    | GetRoleDto
    | GetOwnershipDto
) => {
  const name = entity.constructor.name;
  return `${entity.displayName} (${entityNamesMap[name as keyof typeof entityNamesMap]})`;
};
