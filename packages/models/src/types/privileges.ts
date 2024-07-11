import { privileges } from './privileges-source';

export type PrivilegeCode = keyof typeof privileges;
export const privilegeCodes = Object.keys(privileges) as PrivilegeCode[];
export const privilegesArray = privilegeCodes.map((key) => ({
  code: key,
  description: privileges[key],
}));
export type SbEnvironmentPrivileges =
  | 'sb-environment.edfi-tenant:read'
  | 'sb-environment.edfi-tenant:update'
  | 'sb-environment.edfi-tenant:delete'
  | 'sb-environment.edfi-tenant:create'
  | 'sb-environment.edfi-tenant:refresh-resources';

export type TeamPrivileges =
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
  | 'team.sb-environment:create-tenant'
  | 'team.sb-environment:delete-tenant'
  | 'team.sb-environment.edfi-tenant:read'
  | 'team.sb-environment.edfi-tenant:create-ods'
  | 'team.sb-environment.edfi-tenant:delete-ods'
  | 'team.sb-environment.edfi-tenant.vendor:read'
  | 'team.sb-environment.edfi-tenant.vendor:update'
  | 'team.sb-environment.edfi-tenant.vendor:delete'
  | 'team.sb-environment.edfi-tenant.vendor:create'
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

export type TeamSbEnvironmentPrivileges =
  | 'team.sb-environment.edfi-tenant:read'
  | 'team.sb-environment.edfi-tenant:create-ods'
  | 'team.sb-environment.edfi-tenant:delete-ods'
  | 'team.sb-environment.edfi-tenant.vendor:read'
  | 'team.sb-environment.edfi-tenant.vendor:update'
  | 'team.sb-environment.edfi-tenant.vendor:delete'
  | 'team.sb-environment.edfi-tenant.vendor:create'
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

export type TeamSbEnvironmentEdfiTenantPrivileges =
  | 'team.sb-environment.edfi-tenant.vendor:read'
  | 'team.sb-environment.edfi-tenant.vendor:update'
  | 'team.sb-environment.edfi-tenant.vendor:delete'
  | 'team.sb-environment.edfi-tenant.vendor:create'
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

export type TeamSbEnvironmentEdfiTenantOdsPrivileges =
  | 'team.sb-environment.edfi-tenant.ods.edorg:read'
  | 'team.sb-environment.edfi-tenant.ods.edorg.application:read'
  | 'team.sb-environment.edfi-tenant.ods.edorg.application:update'
  | 'team.sb-environment.edfi-tenant.ods.edorg.application:delete'
  | 'team.sb-environment.edfi-tenant.ods.edorg.application:create'
  | 'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials';

export type TeamSbEnvironmentEdfiTenantOdsEdorgPrivileges =
  | 'team.sb-environment.edfi-tenant.ods.edorg.application:read'
  | 'team.sb-environment.edfi-tenant.ods.edorg.application:update'
  | 'team.sb-environment.edfi-tenant.ods.edorg.application:delete'
  | 'team.sb-environment.edfi-tenant.ods.edorg.application:create'
  | 'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials';

export const SbEnvironmentResourcePrivileges = {
  'sb-environment.edfi-tenant': [
    'sb-environment.edfi-tenant:read',
    'sb-environment.edfi-tenant:update',
    'sb-environment.edfi-tenant:delete',
    'sb-environment.edfi-tenant:create',
    'sb-environment.edfi-tenant:refresh-resources',
  ],
};

export const TeamResourcePrivileges = {
  'team.ownership': ['team.ownership:read'],
  'team.role': ['team.role:read', 'team.role:update', 'team.role:delete', 'team.role:create'],
  'team.user': ['team.user:read'],
  'team.user-team-membership': [
    'team.user-team-membership:read',
    'team.user-team-membership:update',
    'team.user-team-membership:delete',
    'team.user-team-membership:create',
  ],
  'team.sb-environment': [
    'team.sb-environment:read',
    'team.sb-environment:create-tenant',
    'team.sb-environment:delete-tenant',
  ],
  'team.sb-environment.edfi-tenant': [
    'team.sb-environment.edfi-tenant:read',
    'team.sb-environment.edfi-tenant:create-ods',
    'team.sb-environment.edfi-tenant:delete-ods',
  ],
  'team.sb-environment.edfi-tenant.vendor': [
    'team.sb-environment.edfi-tenant.vendor:read',
    'team.sb-environment.edfi-tenant.vendor:update',
    'team.sb-environment.edfi-tenant.vendor:delete',
    'team.sb-environment.edfi-tenant.vendor:create',
  ],
  'team.sb-environment.edfi-tenant.claimset': [
    'team.sb-environment.edfi-tenant.claimset:read',
    'team.sb-environment.edfi-tenant.claimset:update',
    'team.sb-environment.edfi-tenant.claimset:delete',
    'team.sb-environment.edfi-tenant.claimset:create',
  ],
  'team.sb-environment.edfi-tenant.ods': [
    'team.sb-environment.edfi-tenant.ods:read',
    'team.sb-environment.edfi-tenant.ods:read-row-counts',
    'team.sb-environment.edfi-tenant.ods:create-edorg',
    'team.sb-environment.edfi-tenant.ods:delete-edorg',
  ],
  'team.sb-environment.edfi-tenant.ods.edorg': ['team.sb-environment.edfi-tenant.ods.edorg:read'],
  'team.sb-environment.edfi-tenant.ods.edorg.application': [
    'team.sb-environment.edfi-tenant.ods.edorg.application:read',
    'team.sb-environment.edfi-tenant.ods.edorg.application:update',
    'team.sb-environment.edfi-tenant.ods.edorg.application:delete',
    'team.sb-environment.edfi-tenant.ods.edorg.application:create',
    'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials',
  ],
};

export const TeamSbEnvironmentResourcePrivileges = {
  'team.sb-environment.edfi-tenant': [
    'team.sb-environment.edfi-tenant:read',
    'team.sb-environment.edfi-tenant:create-ods',
    'team.sb-environment.edfi-tenant:delete-ods',
  ],
  'team.sb-environment.edfi-tenant.vendor': [
    'team.sb-environment.edfi-tenant.vendor:read',
    'team.sb-environment.edfi-tenant.vendor:update',
    'team.sb-environment.edfi-tenant.vendor:delete',
    'team.sb-environment.edfi-tenant.vendor:create',
  ],
  'team.sb-environment.edfi-tenant.claimset': [
    'team.sb-environment.edfi-tenant.claimset:read',
    'team.sb-environment.edfi-tenant.claimset:update',
    'team.sb-environment.edfi-tenant.claimset:delete',
    'team.sb-environment.edfi-tenant.claimset:create',
  ],
  'team.sb-environment.edfi-tenant.ods': [
    'team.sb-environment.edfi-tenant.ods:read',
    'team.sb-environment.edfi-tenant.ods:read-row-counts',
    'team.sb-environment.edfi-tenant.ods:create-edorg',
    'team.sb-environment.edfi-tenant.ods:delete-edorg',
  ],
  'team.sb-environment.edfi-tenant.ods.edorg': ['team.sb-environment.edfi-tenant.ods.edorg:read'],
  'team.sb-environment.edfi-tenant.ods.edorg.application': [
    'team.sb-environment.edfi-tenant.ods.edorg.application:read',
    'team.sb-environment.edfi-tenant.ods.edorg.application:update',
    'team.sb-environment.edfi-tenant.ods.edorg.application:delete',
    'team.sb-environment.edfi-tenant.ods.edorg.application:create',
    'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials',
  ],
};

export const TeamSbEnvironmentEdfiTenantResourcePrivileges = {
  'team.sb-environment.edfi-tenant.vendor': [
    'team.sb-environment.edfi-tenant.vendor:read',
    'team.sb-environment.edfi-tenant.vendor:update',
    'team.sb-environment.edfi-tenant.vendor:delete',
    'team.sb-environment.edfi-tenant.vendor:create',
  ],
  'team.sb-environment.edfi-tenant.claimset': [
    'team.sb-environment.edfi-tenant.claimset:read',
    'team.sb-environment.edfi-tenant.claimset:update',
    'team.sb-environment.edfi-tenant.claimset:delete',
    'team.sb-environment.edfi-tenant.claimset:create',
  ],
  'team.sb-environment.edfi-tenant.ods': [
    'team.sb-environment.edfi-tenant.ods:read',
    'team.sb-environment.edfi-tenant.ods:read-row-counts',
    'team.sb-environment.edfi-tenant.ods:create-edorg',
    'team.sb-environment.edfi-tenant.ods:delete-edorg',
  ],
  'team.sb-environment.edfi-tenant.ods.edorg': ['team.sb-environment.edfi-tenant.ods.edorg:read'],
  'team.sb-environment.edfi-tenant.ods.edorg.application': [
    'team.sb-environment.edfi-tenant.ods.edorg.application:read',
    'team.sb-environment.edfi-tenant.ods.edorg.application:update',
    'team.sb-environment.edfi-tenant.ods.edorg.application:delete',
    'team.sb-environment.edfi-tenant.ods.edorg.application:create',
    'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials',
  ],
};

export const TeamSbEnvironmentEdfiTenantOdsResourcePrivileges = {
  'team.sb-environment.edfi-tenant.ods.edorg': ['team.sb-environment.edfi-tenant.ods.edorg:read'],
  'team.sb-environment.edfi-tenant.ods.edorg.application': [
    'team.sb-environment.edfi-tenant.ods.edorg.application:read',
    'team.sb-environment.edfi-tenant.ods.edorg.application:update',
    'team.sb-environment.edfi-tenant.ods.edorg.application:delete',
    'team.sb-environment.edfi-tenant.ods.edorg.application:create',
    'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials',
  ],
};

export const TeamSbEnvironmentEdfiTenantOdsEdorgResourcePrivileges = {
  'team.sb-environment.edfi-tenant.ods.edorg.application': [
    'team.sb-environment.edfi-tenant.ods.edorg.application:read',
    'team.sb-environment.edfi-tenant.ods.edorg.application:update',
    'team.sb-environment.edfi-tenant.ods.edorg.application:delete',
    'team.sb-environment.edfi-tenant.ods.edorg.application:create',
    'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials',
  ],
};

export type PrivilegeResources =
  | 'me'
  | 'ownership'
  | 'role'
  | 'sb-environment.edfi-tenant'
  | 'sb-environment'
  | 'ods'
  | 'edorg'
  | 'user'
  | 'team'
  | 'user-team-membership'
  | 'team.ownership'
  | 'team.role'
  | 'team.user'
  | 'team.user-team-membership'
  | 'team.sb-environment'
  | 'team.sb-environment.edfi-tenant'
  | 'team.sb-environment.edfi-tenant.vendor'
  | 'team.sb-environment.edfi-tenant.claimset'
  | 'team.sb-environment.edfi-tenant.ods'
  | 'team.sb-environment.edfi-tenant.ods.edorg'
  | 'team.sb-environment.edfi-tenant.ods.edorg.application'
  | 'sb-sync-queue';
