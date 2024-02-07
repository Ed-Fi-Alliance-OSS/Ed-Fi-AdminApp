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
  | 'sbe:read'
  | 'sbe:update'
  | 'sbe:delete'
  | 'sbe:create'
  | 'sbe:refresh-resources'
  | 'sb-sync-queue:read'
  | 'sb-sync-queue:archive'
  | 'ods:read'
  | 'edorg:read'
  | 'privilege:read'
  | 'user:read'
  | 'user:update'
  | 'user:delete'
  | 'user:create'
  | 'tenant:read'
  | 'tenant:update'
  | 'tenant:delete'
  | 'tenant:create'
  | 'user-tenant-membership:read'
  | 'user-tenant-membership:update'
  | 'user-tenant-membership:delete'
  | 'user-tenant-membership:create';

export type TenantBasePrivilege =
  | 'tenant.ownership:read'
  | 'tenant.role:read'
  | 'tenant.role:update'
  | 'tenant.role:delete'
  | 'tenant.role:create'
  | 'tenant.user:read'
  | 'tenant.user-tenant-membership:read'
  | 'tenant.user-tenant-membership:update'
  | 'tenant.user-tenant-membership:delete'
  | 'tenant.user-tenant-membership:create'
  | 'tenant.sbe:read'
  | 'tenant.sbe:refresh-resources';

export type TenantSbePrivilege =
  | 'tenant.sbe.vendor:read'
  | 'tenant.sbe.vendor:update'
  | 'tenant.sbe.vendor:delete'
  | 'tenant.sbe.vendor:create'
  | 'tenant.sbe.claimset:read'
  | 'tenant.sbe.claimset:update'
  | 'tenant.sbe.claimset:delete'
  | 'tenant.sbe.claimset:create'
  | 'tenant.sbe.ods:read'
  | 'tenant.sbe.edorg:read'
  | 'tenant.sbe.edorg.application:read'
  | 'tenant.sbe.edorg.application:update'
  | 'tenant.sbe.edorg.application:delete'
  | 'tenant.sbe.edorg.application:create'
  | 'tenant.sbe.edorg.application:reset-credentials';

export type PrivilegeCode = BasePrivilege | TenantBasePrivilege | TenantSbePrivilege;

export const privilegeCodes = [
  'me:read',
  'ownership:read',
  'ownership:update',
  'ownership:delete',
  'ownership:create',
  'role:read',
  'role:update',
  'role:delete',
  'role:create',
  'sbe:read',
  'sbe:update',
  'sbe:delete',
  'sbe:create',
  'sbe:refresh-resources',
  'sb-sync-queue:read',
  'sb-sync-queue:archive',
  'ods:read',
  'edorg:read',
  'privilege:read',
  'user:read',
  'user:update',
  'user:delete',
  'user:create',
  'tenant:read',
  'tenant:update',
  'tenant:delete',
  'tenant:create',
  'user-tenant-membership:read',
  'user-tenant-membership:update',
  'user-tenant-membership:delete',
  'user-tenant-membership:create',
  'tenant.ownership:read',
  'tenant.role:read',
  'tenant.role:update',
  'tenant.role:delete',
  'tenant.role:create',
  'tenant.user:read',
  'tenant.user-tenant-membership:read',
  'tenant.user-tenant-membership:update',
  'tenant.user-tenant-membership:delete',
  'tenant.user-tenant-membership:create',
  'tenant.sbe:read',
  'tenant.sbe:refresh-resources',
  'tenant.sbe.vendor:read',
  'tenant.sbe.vendor:update',
  'tenant.sbe.vendor:delete',
  'tenant.sbe.vendor:create',
  'tenant.sbe.claimset:read',
  'tenant.sbe.claimset:update',
  'tenant.sbe.claimset:delete',
  'tenant.sbe.claimset:create',
  'tenant.sbe.ods:read',
  'tenant.sbe.edorg:read',
  'tenant.sbe.edorg.application:read',
  'tenant.sbe.edorg.application:update',
  'tenant.sbe.edorg.application:delete',
  'tenant.sbe.edorg.application:create',
  'tenant.sbe.edorg.application:reset-credentials',
];
