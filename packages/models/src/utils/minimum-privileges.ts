import { PrivilegeCode } from '..';

/**
 * Minimum privileges are the set of privileges that are baked into how the app works,
 * and it's not considered valid to have one of the inner/lower/nested ones without having the ones above it.
 */
export const upwardInheritancePrivileges = new Set<PrivilegeCode>([
  'team.sb-environment:read',
  'team.sb-environment.edfi-tenant:read',
  'team.sb-environment.edfi-tenant.ods:read',
  'team.sb-environment.edfi-tenant.ods.edorg:read',
  'team.sb-environment.edfi-tenant.claimset:read',
  'team.sb-environment.edfi-tenant.vendor:read',
]);
export const minimumPrivileges = upwardInheritancePrivileges;
