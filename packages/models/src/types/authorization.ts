import {
  BasePrivilege,
  PrivilegeCode,
  TenantBasePrivilege,
  TenantSbePrivilege,
} from './privilege.type';

export type AuthorizationCache = Partial<Record<BasePrivilege, TrueValue>> & ITenantCache;

export type TrueValue = true;
export type SpecificIds = Set<number | string>;
export type Ids = SpecificIds | TrueValue;

export const isAll = (ids: Ids): ids is TrueValue => typeof ids === 'boolean' && ids;

/*

TODO The code around privileges and authorization rule helpers is an ungainly mixture of TS utilities, non-DRY object maps, and function overloads. There's probably a way to make it much better, but watch out for the usability. We've abandoned a couple DRYer refactors already because of what they did to intellisense.

  a) separately type both SBE-nested and non-SBE-nested privilege strings, to power the overloads
  b) type the "child segment" of those "full" strings (e.g. edorg.application:read is the child segment of tenant.sbe.edorg.application:read)
  c) map the full strings onto the child segment
  d) map the full strings onto the parent segment (e.g. tenant.sbe)
  e) type the "resource segment" of the both the SBE-nested and non-SBE-nested full privilege strings (e.g. tenant.ownership for tenant.ownership:read, or edorg.application for tenant.sbe.edorg.application)
  f) map the "resource segment" strings onto arrays of all associated privileges
  g) provide good typing hints. Sometimes you can find a more DRY way of getting a type, but it loses the nice intellisense compared to explicit string unions.
  h) support the different overloads for SBE vs non-SBE privileges passed into the helpers.
  i) specify `true` as the sole possible value where appropriate (i.e. for `create` privileges)

*/

export type SbeSubEntityPrivilege =
  | 'vendor:read'
  | 'vendor:update'
  | 'vendor:delete'
  | 'vendor:create'
  | 'claimset:read'
  | 'claimset:update'
  | 'claimset:delete'
  | 'claimset:create'
  | 'ods:read'
  | 'edorg:read'
  | 'edorg.application:read'
  | 'edorg.application:update'
  | 'edorg.application:delete'
  | 'edorg.application:create'
  | 'edorg.application:reset-credentials';

export const globalPrivilegesMap: Record<BasePrivilege, true> = {
  'me:read': true,
  'ownership:read': true,
  'ownership:update': true,
  'ownership:delete': true,
  'ownership:create': true,
  'sbe:read': true,
  'ods:read': true,
  'edorg:read': true,
  'sbe:update': true,
  'sbe:delete': true,
  'sbe:create': true,
  'sbe:refresh-resources': true,
  'sb-sync-queue:read': true,
  'sb-sync-queue:archive': true,
  'privilege:read': true,
  'user:read': true,
  'user:update': true,
  'user:delete': true,
  'user:create': true,
  'role:read': true,
  'role:update': true,
  'role:delete': true,
  'role:create': true,
  'tenant:read': true,
  'tenant:update': true,
  'tenant:delete': true,
  'tenant:create': true,
  'user-tenant-membership:read': true,
  'user-tenant-membership:update': true,
  'user-tenant-membership:delete': true,
  'user-tenant-membership:create': true,
};

export const isGlobalPrivilege = (privilege: PrivilegeCode): privilege is BasePrivilege =>
  privilege in globalPrivilegesMap;

export const sbeTenantPrivilegesMap: Record<TenantSbePrivilege, SbeSubEntityPrivilege> = {
  'tenant.sbe.vendor:read': 'vendor:read',
  'tenant.sbe.vendor:update': 'vendor:update',
  'tenant.sbe.vendor:delete': 'vendor:delete',
  'tenant.sbe.vendor:create': 'vendor:create',
  'tenant.sbe.claimset:read': 'claimset:read',
  'tenant.sbe.claimset:update': 'claimset:update',
  'tenant.sbe.claimset:delete': 'claimset:delete',
  'tenant.sbe.claimset:create': 'claimset:create',
  'tenant.sbe.ods:read': 'ods:read',
  'tenant.sbe.edorg:read': 'edorg:read',
  'tenant.sbe.edorg.application:read': 'edorg.application:read',
  'tenant.sbe.edorg.application:update': 'edorg.application:update',
  'tenant.sbe.edorg.application:delete': 'edorg.application:delete',
  'tenant.sbe.edorg.application:create': 'edorg.application:create',
  'tenant.sbe.edorg.application:reset-credentials': 'edorg.application:reset-credentials',
};

/**
 * Structure of the tenant resource ownership cache. Each privilege is mapped
 * to the set of all IDs of that resource which are valid for use with that privilege.
 *
 * __IMPORTANT: Applications use the ID of their Edorg, rather than their own ID.__
 * This means filtering must be done after retrieval (which is necessary anyway,
 * which is why we do it like this). By virtue of our particular business logic,
 * vendors and claimsets are either `true` or nothing. Together, these
 * make it possible to entirely avoid having to query the Admin API during cache
 * building.
 */
export interface ITenantCache
  extends Partial<
    Record<TenantBasePrivilege, Ids> & Record<TenantSbePrivilege, Record<number, Ids>>
  > {
  'tenant.ownership:read'?: Ids;
  'tenant.role:read'?: Ids;
  'tenant.role:update'?: Ids;
  'tenant.role:delete'?: Ids;
  'tenant.role:create'?: TrueValue;
  'tenant.user:read'?: Ids;
  'tenant.user-tenant-membership:read'?: Ids;
  'tenant.user-tenant-membership:update'?: Ids;
  'tenant.user-tenant-membership:delete'?: Ids;
  'tenant.user-tenant-membership:create'?: TrueValue;
  'tenant.sbe:read'?: Ids;
  'tenant.sbe.vendor:read'?: Record<number, Ids>;
  'tenant.sbe.vendor:update'?: Record<number, Ids>;
  'tenant.sbe.vendor:delete'?: Record<number, Ids>;
  'tenant.sbe.vendor:create'?: Record<number, TrueValue>;
  'tenant.sbe.claimset:read'?: Record<number, Ids>;
  'tenant.sbe.claimset:update'?: Record<number, Ids>;
  'tenant.sbe.claimset:delete'?: Record<number, Ids>;
  'tenant.sbe.claimset:create'?: Record<number, TrueValue>;
  'tenant.sbe.ods:read'?: Record<number, Ids>;
  'tenant.sbe.edorg:read'?: Record<number, Ids>;
  'tenant.sbe.edorg.application:read'?: Record<number, Ids>;
  'tenant.sbe.edorg.application:update'?: Record<number, Ids>;
  'tenant.sbe.edorg.application:delete'?: Record<number, Ids>;
  'tenant.sbe.edorg.application:create'?: Record<number, TrueValue>;
  'tenant.sbe.edorg.application:reset-credentials'?: Record<number, Ids>;
}

export const trueOnlyPrivileges = new Set<TenantBasePrivilege | TenantSbePrivilege>([
  'tenant.role:create',
  'tenant.sbe.claimset:create',
  'tenant.sbe.vendor:create',
]);
export const isBaseTenantPrivilege = (str: string): str is TenantBasePrivilege =>
  new Set(Object.values(baseResourcePrivilegesMap).flat()).has(str as any);
export const baseResourcePrivilegesMap: Partial<Record<string, TenantBasePrivilege[]>> = {
  'tenant.user': ['tenant.user:read'],
  'tenant.user-tenant-membership': [
    'tenant.user-tenant-membership:read',
    'tenant.user-tenant-membership:update',
    'tenant.user-tenant-membership:delete',
    'tenant.user-tenant-membership:create',
  ],
  'tenant.role': [
    'tenant.role:read',
    'tenant.role:update',
    'tenant.role:delete',
    'tenant.role:create',
  ],
  'tenant.ownership': ['tenant.ownership:read'],
  'tenant.sbe': ['tenant.sbe:read', 'tenant.sbe:refresh-resources'],
};

export const sbeResourcePrivilegesMap: Partial<Record<string, TenantSbePrivilege[]>> = {
  'tenant.sbe.vendor': [
    'tenant.sbe.vendor:read',
    'tenant.sbe.vendor:update',
    'tenant.sbe.vendor:delete',
    'tenant.sbe.vendor:create',
  ],
  'tenant.sbe.claimset': [
    'tenant.sbe.claimset:read',
    'tenant.sbe.claimset:update',
    'tenant.sbe.claimset:delete',
    'tenant.sbe.claimset:create',
  ],
  'tenant.sbe.ods': ['tenant.sbe.ods:read'],
  'tenant.sbe.edorg': ['tenant.sbe.edorg:read'],
  'tenant.sbe.edorg.application': [
    'tenant.sbe.edorg.application:read',
    'tenant.sbe.edorg.application:update',
    'tenant.sbe.edorg.application:delete',
    'tenant.sbe.edorg.application:create',
    'tenant.sbe.edorg.application:reset-credentials',
  ],
};

export type BasePrivilegeResourceType = keyof typeof baseResourcePrivilegesMap;
export type SbePrivilegeResourceType = keyof typeof sbeResourcePrivilegesMap;
export type PrivilegeResource = BasePrivilegeResourceType | SbePrivilegeResourceType;

export const isTenantSbePrivilege = (str: string): str is TenantSbePrivilege =>
  str in sbeTenantPrivilegesMap;
