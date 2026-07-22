import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';

export type VersionedResourceKey = 'v2' | 'v3';

/**
 * Build a hook that resolves a per-admin-api-version config object (queries,
 * DTO classes, whatever a page needs) from the current tenant's resolved
 * version. V1 is intentionally excluded — this is for the "V2 and later"
 * pattern only.
 */
export function createVersionedResource<Config>(
  byVersion: Partial<Record<VersionedResourceKey, Config>>
) {
  return function useVersionedResource(): Config {
    const { edfiTenant } = useTeamEdfiTenantNavContextLoaded();
    const version = edfiTenant.sbEnvironment.version;
    const resource = version ? byVersion[version as VersionedResourceKey] : undefined;
    if (!resource) {
      throw new Error(`No resource registered for admin API version "${version}"`);
    }
    return resource;
  };
}
