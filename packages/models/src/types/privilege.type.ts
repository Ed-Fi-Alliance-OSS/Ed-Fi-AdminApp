import { IPrivilege } from '../interfaces';
import { PrivilegeCode } from './privileges';
import { privileges } from './privileges-source';

export type ProviderPrivilege =
  | 'integration-provider:read'
  | 'integration-provider:update'
  | 'integration-provider:delete'
  | 'integration-provider:create';

export type BasePrivilege =
  | 'me:read'
  | 'ownership:read'
  | 'ownership:update'
  | 'ownership:delete'
  | 'ownership:create'
  | 'role:read'
  | 'role:update'
  | 'role:delete'
  | 'role:create'
  | 'sb-environment.edfi-tenant:read'
  | 'sb-environment.edfi-tenant:update'
  | 'sb-environment.edfi-tenant:delete'
  | 'sb-environment.edfi-tenant:create'
  | 'sb-environment.edfi-tenant:refresh-resources'
  | 'sb-environment:read'
  | 'sb-environment:update'
  | 'sb-environment:delete'
  | 'sb-environment:create'
  | 'sb-environment:refresh-resources'
  | 'sb-sync-queue:read'
  | 'sb-sync-queue:archive'
  | 'ods:read'
  | 'ods:read-row-counts'
  | 'edorg:read'
  | 'user:read'
  | 'user:update'
  | 'user:delete'
  | 'user:create'
  | 'team:read'
  | 'team:update'
  | 'team:delete'
  | 'team:create'
  | 'user-team-membership:read'
  | 'user-team-membership:update'
  | 'user-team-membership:delete'
  | 'user-team-membership:create'
  | ProviderPrivilege;

export type TeamBasePrivilege =
  | 'team.ownership:read'
  | 'team.role:read'
  | 'team.role:update'
  | 'team.role:delete'
  | 'team.role:create'
  | 'team.user:read'
  | 'team.user-team-membership:read'
  | 'team.user-team-membership:update'
  | 'team.user-team-membership:delete'
  | 'team.user-team-membership:create'
  | 'team.sb-environment:read'
  | 'team.sb-environment:delete-tenant'
  | 'team.sb-environment:create-tenant';

export type TeamSbEnvironmentPrivilege = 'team.sb-environment.edfi-tenant:read';

export type TeamEdfiTenantPrivilege =
  | 'team.sb-environment.edfi-tenant:create-ods'
  | 'team.sb-environment.edfi-tenant:delete-ods'
  | 'team.sb-environment.edfi-tenant.vendor:read'
  | 'team.sb-environment.edfi-tenant.vendor:update'
  | 'team.sb-environment.edfi-tenant.vendor:delete'
  | 'team.sb-environment.edfi-tenant.vendor:create'
  | 'team.sb-environment.edfi-tenant.profile:read'
  | 'team.sb-environment.edfi-tenant.profile:update'
  | 'team.sb-environment.edfi-tenant.profile:delete'
  | 'team.sb-environment.edfi-tenant.profile:create'
  | 'team.sb-environment.edfi-tenant.claimset:read'
  | 'team.sb-environment.edfi-tenant.claimset:update'
  | 'team.sb-environment.edfi-tenant.claimset:delete'
  | 'team.sb-environment.edfi-tenant.claimset:create'
  | 'team.sb-environment.edfi-tenant.ods:read'
  | 'team.sb-environment.edfi-tenant.ods:read-row-counts'
  | 'team.sb-environment.edfi-tenant.ods:create-edorg'
  | 'team.sb-environment.edfi-tenant.ods:delete-edorg'
  | 'team.sb-environment.edfi-tenant.ods.edorg:read'
  | 'team.sb-environment.edfi-tenant.ods.edorg.application:read'
  | 'team.sb-environment.edfi-tenant.ods.edorg.application:update'
  | 'team.sb-environment.edfi-tenant.ods.edorg.application:delete'
  | 'team.sb-environment.edfi-tenant.ods.edorg.application:create'
  | 'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials';

export const PRIVILEGES = Object.fromEntries(
  Object.keys(privileges).map((p) => [p, { code: p, description: privileges[p as PrivilegeCode] }])
) as Record<PrivilegeCode, IPrivilege>;

export const PRIVILEGE_CODES = Object.keys(privileges) as PrivilegeCode[];
export const TEAM_EDFI_TENANT_PRIVILEGES: TeamEdfiTenantPrivilege[] = PRIVILEGE_CODES.filter((p) =>
  p.startsWith('team.sb-environment.edfi-tenant')
) as TeamEdfiTenantPrivilege[];
