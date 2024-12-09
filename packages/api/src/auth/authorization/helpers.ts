import { defineAbility } from '@casl/ability';
import {
  AuthorizationCache,
  BasePrivilegeResourceType,
  EdfiTenantPrivilegeResourceType,
  ITeamCache,
  PrivilegeCode,
  PrivilegeResource,
  SpecificIds,
  TEAM_EDFI_TENANT_PRIVILEGES,
  TeamBasePrivilege,
  TeamEdfiTenantPrivilege,
  TeamSbEnvironmentPrivilege,
  TrueValue,
  baseTeamResourcePrivilegesMap,
  edorgCompositeKey,
  edfiTenantResourcePrivilegesMap,
  isGlobalPrivilege,
  isCachedByEdfiTenant,
  resourcePrivileges,
  trueOnlyPrivileges,
  upwardInheritancePrivileges,
  isCachedBySbEnvironment,
  sbEnvironmentResourcePrivilegesMap,
  edorgKeyV2,
  minimumPrivileges,
} from '@edanalytics/models';
import { EdfiTenant, Edorg, SbEnvironment } from '@edanalytics/models-server';

/**
 * Add a resource ID into the cache of IDs allowable for a specific privilege.
 *
 * @param cache cache to mutate
 * @param privilege privilege against which to cache the id
 * @param id id to cache
 */
export function addIdTo({
  cache,
  privilege,
  id,
}: {
  cache: ITeamCache;
  privilege: TeamBasePrivilege;
  id: number | string | TrueValue;
}): void;
/**
 * Add a resource ID into the cache of IDs allowable for a specific privilege.
 *
 * @param cache cache to mutate
 * @param privilege privilege against which to cache the id
 * @param id id to cache
 * @param edfiTenantId id of the EdfiTenant which owns this resource
 */
export function addIdTo({
  cache,
  privilege,
  id,
  edfiTenantId,
}: {
  cache: ITeamCache;
  privilege: TeamEdfiTenantPrivilege;
  id: number | string | TrueValue;
  edfiTenantId: number;
}): void;
/**
 * Add a resource ID into the cache of IDs allowable for a specific privilege.
 *
 * @param cache cache to mutate
 * @param privilege privilege against which to cache the id
 * @param id id to cache
 * @param sbEnvironmentId id of the SbEnvironment which owns this resource
 */
export function addIdTo({
  cache,
  privilege,
  id,
  sbEnvironmentId,
}: {
  cache: ITeamCache;
  privilege: TeamSbEnvironmentPrivilege;
  id: number | string | TrueValue;
  sbEnvironmentId: number;
}): void;
export function addIdTo({
  cache,
  privilege,
  id,
  edfiTenantId,
  sbEnvironmentId,
}: {
  cache: ITeamCache;
  privilege: TeamBasePrivilege | TeamEdfiTenantPrivilege | TeamSbEnvironmentPrivilege;
  id: number | string | TrueValue;
  edfiTenantId?: number;
  sbEnvironmentId?: number;
}): void {
  if (isCachedByEdfiTenant(privilege)) {
    if (cache[privilege] === undefined) {
      cache[privilege] = {};
    }
    if (cache[privilege][edfiTenantId] !== true) {
      if (id !== true && !trueOnlyPrivileges.has(privilege)) {
        if (cache[privilege][edfiTenantId] === undefined) {
          cache[privilege][edfiTenantId] = new Set([id]);
        } else {
          (cache[privilege][edfiTenantId] as SpecificIds).add(id);
        }
      } else {
        cache[privilege][edfiTenantId] = true;
      }
    }
  } else if (isCachedBySbEnvironment(privilege)) {
    if (cache[privilege] === undefined) {
      cache[privilege] = {};
    }
    if (cache[privilege][sbEnvironmentId] !== true) {
      if (id !== true && !trueOnlyPrivileges.has(privilege)) {
        if (cache[privilege][sbEnvironmentId] === undefined) {
          cache[privilege][sbEnvironmentId] = new Set([id]);
        } else {
          (cache[privilege][sbEnvironmentId] as SpecificIds).add(id);
        }
      } else {
        cache[privilege][sbEnvironmentId] = true;
      }
    }
  } else {
    const cachedIds = cache[privilege];
    if (cachedIds !== true) {
      if (id !== true) {
        if (cache[privilege] === undefined) {
          (cache[privilege] as SpecificIds) = new Set([id]);
        } else {
          cachedIds.add(id);
        }
      } else {
        cache[privilege] = id;
      }
    }
  }
}

/**
 * Cache a resource's ID (or a blanket `true`) against all relevant
 * privileges, if any are present. If no relevant privileges have
 * been granted, no action is taken.
 *
 * @param cache cache to mutate
 * @param privileges all granted privileges, or at least all relevant ones
 * @param resource resource type
 * @param id id to cache
 */
export function cacheAccordingToPrivileges({
  cache,
  privileges,
  resource,
  id,
}: {
  cache: ITeamCache;
  privileges: Set<PrivilegeCode | TeamBasePrivilege | TeamEdfiTenantPrivilege>;
  resource: BasePrivilegeResourceType;
  id: number | string | TrueValue;
});
/**
 * Cache a resource's ID (or a blanket `true`) against all relevant
 * privileges, if any are present. If no relevant privileges have
 * been granted, no action is taken.
 *
 * @param cache cache to mutate
 * @param privileges all granted privileges, or at least all relevant ones
 * @param resource resource type
 * @param id id to cache
 * @param edfiTenantId id of the EdfiTenant which owns the resource
 */
export function cacheAccordingToPrivileges({
  cache,
  privileges,
  resource,
  id,
  edfiTenantId,
}: {
  cache: ITeamCache;
  privileges: Set<PrivilegeCode>;
  resource: EdfiTenantPrivilegeResourceType;
  id: number | string | TrueValue;
  edfiTenantId: number;
});
/**
 * Cache a resource's ID (or a blanket `true`) against all relevant
 * privileges, if any are present. If no relevant privileges have
 * been granted, no action is taken.
 *
 * @param cache cache to mutate
 * @param privileges all granted privileges, or at least all relevant ones
 * @param resource resource type
 * @param id id to cache
 * @param sbEnvironmentId id of the SbEnvironment which owns the resource
 */
export function cacheAccordingToPrivileges({
  cache,
  privileges,
  resource,
  id,
  sbEnvironmentId,
}: {
  cache: ITeamCache;
  privileges: Set<PrivilegeCode>;
  resource: EdfiTenantPrivilegeResourceType;
  id: number | string | TrueValue;
  sbEnvironmentId: number;
});
export function cacheAccordingToPrivileges({
  cache,
  privileges,
  resource,
  id,
  edfiTenantId,
  sbEnvironmentId,
}: {
  cache: ITeamCache;
  privileges: Set<PrivilegeCode>;
  resource: PrivilegeResource;
  id: number | string | TrueValue;
  edfiTenantId?: number;
  sbEnvironmentId?: number;
}) {
  let foundLocation = false;
  if (resource in baseTeamResourcePrivilegesMap) {
    foundLocation = true;
    baseTeamResourcePrivilegesMap[resource]?.forEach((possiblePrivilege) => {
      if (privileges.has(possiblePrivilege)) {
        const idToCache = trueOnlyPrivileges.has(possiblePrivilege) ? true : id;
        addIdTo({ cache, privilege: possiblePrivilege, id: idToCache });
      }
    });
  }
  if (resource in edfiTenantResourcePrivilegesMap) {
    foundLocation = true;
    edfiTenantResourcePrivilegesMap[resource]?.forEach((possiblePrivilege) => {
      if (privileges.has(possiblePrivilege)) {
        const idToCache = trueOnlyPrivileges.has(possiblePrivilege) ? true : id;
        addIdTo({ cache, privilege: possiblePrivilege, id: idToCache, edfiTenantId });
      }
    });
  }
  if (resource in sbEnvironmentResourcePrivilegesMap) {
    foundLocation = true;
    sbEnvironmentResourcePrivilegesMap[resource]?.forEach((possiblePrivilege) => {
      if (privileges.has(possiblePrivilege)) {
        const idToCache = trueOnlyPrivileges.has(possiblePrivilege) ? true : id;
        addIdTo({ cache, privilege: possiblePrivilege, id: idToCache, sbEnvironmentId });
      }
    });
  }
  if (!foundLocation) {
    throw new Error("Resource doesn't have a known caching location.");
  }
}

/**
 * Initialize all relevant edfi-tenant-level privilege caches to a blanket `true`
 *
 * */
export function initializeEdfiTenantPrivilegeCache(
  cache: ITeamCache,
  privileges: Set<PrivilegeCode>,
  edfiTenantId: number
) {
  resourcePrivileges('team.sb-environment.edfi-tenant').forEach(
    (edfiTenantTeamPrivilege: PrivilegeCode) => {
      if (isCachedByEdfiTenant(edfiTenantTeamPrivilege)) {
        if (privileges.has(edfiTenantTeamPrivilege)) {
          if (!(edfiTenantTeamPrivilege in cache)) {
            cache[edfiTenantTeamPrivilege] = {};
          }
          cache[edfiTenantTeamPrivilege][edfiTenantId] = true;
        }
      }
    }
  );
}

/**
 * Initialize all relevant sb-environment-level privilege caches to a blanket `true`
 * */
export function initializeSbEnvironmentPrivilegeCache(
  cache: ITeamCache,
  privileges: Set<PrivilegeCode>,
  sbEnvironment: SbEnvironment
) {
  resourcePrivileges('team.sb-environment').forEach((privilege: PrivilegeCode) => {
    if (privileges.has(privilege)) {
      if (!(privilege in cache)) {
        cache[privilege] = {};
      }
      if (isCachedByEdfiTenant(privilege)) {
        sbEnvironment.edfiTenants.forEach(({ id }) => {
          cache[privilege][id] = true;
        });
      } else if (isCachedBySbEnvironment(privilege)) {
        cache[privilege][sbEnvironment.id] = true; // TODO not great that some are dicts of EdfiTenant while others are of SbEnvironment
      }
    }
  });
}
/**
 * Initialize all relevant ods-inherited privilege caches to an empty set
 *
 * This uses an empty set whereas the edfiTenant version uses a
 * blanket `true`. The difference is that the edfi-tenant-level ones
 * are actually executed at the edfiTenant level, so the cache value
 * can just go straight there. The ods-level ones are
 * executed at the individual resource level though, so while
 * we do have the privilege "in theory", it will only get
 * cached when we encounter the actual resource in question,
 * which might be an ed-org for example. The empty set is the
 * cache's representation of having a privilege "in theory",
 * and it's important for the edge case where you own an ODS
 * with the ability to read its edorgs, but there are none.
 * Without the empty set you wouldn't see the ed-org page
 * as a nav option.
 *
 * */
export function initializeOdsPrivilegeCache(
  cache: ITeamCache,
  privileges: Set<PrivilegeCode>,
  edfiTenantId: number
) {
  // these are the privileges that are inherited from ODS ownership
  const allOdsPrivileges: PrivilegeCode[] = [
    'team.sb-environment.edfi-tenant.ods.edorg.application:create',
    'team.sb-environment.edfi-tenant.ods.edorg.application:read',
    'team.sb-environment.edfi-tenant.ods.edorg.application:update',
    'team.sb-environment.edfi-tenant.ods.edorg.application:delete',
    'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials',
    'team.sb-environment.edfi-tenant.ods.edorg:read',
  ];

  allOdsPrivileges.forEach((odsTeamPrivilege: PrivilegeCode) => {
    if (privileges.has(odsTeamPrivilege)) {
      if (!(odsTeamPrivilege in cache)) {
        cache[odsTeamPrivilege] = {};
      }
      if (!(String(edfiTenantId) in cache[odsTeamPrivilege])) {
        cache[odsTeamPrivilege][edfiTenantId] = new Set();
      }
    }
  });
}

/** Initialize empty-but-present privilege caches for a team's base (not EdfiTenant-child) privileges */
export function initializeBasePrivilegeCache(cache: ITeamCache, privileges: Set<PrivilegeCode>) {
  TEAM_EDFI_TENANT_PRIVILEGES.forEach((edfiTenantTeamPrivilege: PrivilegeCode) => {
    if (privileges.has(edfiTenantTeamPrivilege)) {
      if (!(edfiTenantTeamPrivilege in cache)) {
        cache[edfiTenantTeamPrivilege] = new Set();
      }
    }
  });
}

/**
 * Climb down the Edorg tree and cache the IDs against the weakly-increasing privilege set. This does _NOT_ do anything about _upward_ inheritance.
 */
export const cacheEdorgPrivilegesDownward = (
  cache: ITeamCache,
  initialPrivileges: Set<PrivilegeCode>,
  edorg: Pick<
    Edorg,
    'id' | 'children' | 'edfiTenantId' | 'odsDbName' | 'odsInstanceId' | 'educationOrganizationId'
  >,
  edorgOwnershipPrivileges: Map<number, Set<PrivilegeCode>>
) => {
  const myPrivileges = new Set(initialPrivileges.values()); // so the other ODS's iterations use EdfiTenant's original privileges
  const ownership = edorgOwnershipPrivileges.get(edorg.id);
  if (ownership) {
    [...ownership.values()].forEach((p) => myPrivileges.add(p));
  }
  cacheAccordingToPrivileges({
    cache,
    privileges: myPrivileges,
    resource: 'team.sb-environment.edfi-tenant.ods.edorg',
    id: edorg.id,
    edfiTenantId: edorg.edfiTenantId,
  });
  const compositeKey =
    edorg.odsInstanceId !== null
      ? edorgKeyV2({
          ods: edorg.odsInstanceId,
          edorg: edorg.educationOrganizationId,
        })
      : edorgCompositeKey({
          ods: edorg.odsDbName,
          edorg: edorg.educationOrganizationId,
        });
  cacheAccordingToPrivileges({
    cache,
    privileges: myPrivileges,
    resource: 'team.sb-environment.edfi-tenant.ods.edorg.application',
    id: compositeKey,
    edfiTenantId: edorg.edfiTenantId,
  });
  edorg.children?.forEach((childEdorg) =>
    cacheEdorgPrivilegesDownward(cache, myPrivileges, childEdorg, edorgOwnershipPrivileges)
  );
};

/**
 * Apply privileges from an edorg ownership to its edorg, ods, edfiTenant, vendor, and claimset _ancestors_. Does _NOT_ climb _down_ the edorg tree.
 *
 * Checks that the supplied privileges include the minimum set, but only applies that minimum &mdash; no _extra_ privileges can be inherited upward.
 */
export const cacheEdorgPrivilegesUpward = ({
  cache,
  edorg,
  edfiTenant,
  ownedPrivileges,
  ancestors,
}: {
  cache: ITeamCache;
  edorg: Edorg;
  edfiTenant: Pick<EdfiTenant, 'sbEnvironmentId'>;
  /** Privileges to apply.
   *
   *  This is a possibly-TBD question of business rules. But we _probably_ don't want it to be possible for an ownership of a leaf entity to grant any more than the minimum default access to its parent trunk entities.
   * */
  ownedPrivileges: Set<PrivilegeCode>;
  ancestors: Edorg[];
}) => {
  [...minimumPrivileges].forEach((mp) => {
    if (!ownedPrivileges.has(mp)) {
      throw new Error(`Resource ownership lacks required permission ${mp}.`);
    }
  });
  const ownedUpwardPrivileges = new Set(
    [...ownedPrivileges].filter((element) => upwardInheritancePrivileges.has(element))
  );
  ancestors.forEach((ancestorEdorg) => {
    cacheAccordingToPrivileges({
      cache,
      privileges: ownedUpwardPrivileges,
      resource: 'team.sb-environment.edfi-tenant.ods.edorg',
      id: ancestorEdorg.id,
      edfiTenantId: ancestorEdorg.edfiTenantId,
    });
  });
  cacheAccordingToPrivileges({
    cache,
    privileges: ownedUpwardPrivileges,
    resource: 'team.sb-environment.edfi-tenant.ods',
    id: edorg.odsId,
    edfiTenantId: edorg.edfiTenantId,
  });
  cacheAccordingToPrivileges({
    cache,
    privileges: ownedUpwardPrivileges,
    resource: 'team.sb-environment.edfi-tenant.claimset',
    id: true,
    edfiTenantId: edorg.edfiTenantId,
  });
  cacheAccordingToPrivileges({
    cache,
    privileges: ownedUpwardPrivileges,
    resource: 'team.sb-environment.edfi-tenant.vendor',
    id: true,
    edfiTenantId: edorg.edfiTenantId,
  });
  cacheAccordingToPrivileges({
    cache,
    privileges: ownedUpwardPrivileges,
    resource: 'team.sb-environment.edfi-tenant.profile',
    id: true,
    edfiTenantId: edorg.edfiTenantId,
  });
  cacheAccordingToPrivileges({
    cache,
    privileges: ownedUpwardPrivileges,
    resource: 'team.sb-environment.edfi-tenant',
    id: edorg.edfiTenantId,
    sbEnvironmentId: edfiTenant.sbEnvironmentId,
  });
  cacheAccordingToPrivileges({
    cache,
    privileges: ownedUpwardPrivileges,
    resource: 'team.sb-environment',
    id: edfiTenant.sbEnvironmentId,
  });
};

/**
 * Turn the cachable resource ownership and privilege structure into a CASL ability.
 *
 * @param cache The object containing the union of the user's global privileges and the user-filtered team privileges.
 * @param teamId ID of the team
 * @returns CASL ability
 */
export const abilityFromCache = (
  cache: AuthorizationCache,
  teamId: number | string | undefined
) => {
  const ability = defineAbility((userCan) => {
    Object.keys(cache ?? {}).forEach((privilegeCode: keyof AuthorizationCache) => {
      if (isGlobalPrivilege(privilegeCode)) {
        // global-scoped privilege
        const privilegeCache = cache[privilegeCode];
        if (privilegeCache !== true) {
          throw new Error(
            'Encountered global-scoped privilege cache which is not a blanket `true`, but authorization system is not built to handle this.'
          );
        }
        const caslSubject = {};
        // subject(privilegeCode, caslSubject);
        userCan(privilegeCode, privilegeCode, caslSubject);
      } else {
        // team-scoped privilege
        if (teamId === undefined || teamId === 'undefined') {
          throw new Error('Attempting to construct team ability but no teamId provided.');
        }

        if (isCachedByEdfiTenant(privilegeCode)) {
          // team-scoped privilege whose cache is a map of edfiTenants to the Ids type
          const privilegeCache = cache[privilegeCode];
          const edfiTenantIds = Object.keys(privilegeCache);
          edfiTenantIds.forEach((edfiTenantId) => {
            const caslSubject =
              privilegeCache[edfiTenantId] === true
                ? {
                    teamId: String(teamId),
                    edfiTenantId: edfiTenantId,
                  }
                : {
                    teamId: String(teamId),
                    edfiTenantId: edfiTenantId,
                    id: {
                      $in: [
                        '__filtered__',
                        ...[...privilegeCache[edfiTenantId]].map((v) => String(v)),
                      ],
                    },
                  };
            // subject('privilegeCode', caslSubject);
            userCan(privilegeCode, privilegeCode, caslSubject);
          });
        } else if (isCachedBySbEnvironment(privilegeCode)) {
          // team-scoped privilege whose cache is a map of edfiTenants to the Ids type
          const privilegeCache = cache[privilegeCode];
          const sbEnvironmentIds = Object.keys(privilegeCache);
          sbEnvironmentIds.forEach((sbEnvironmentId) => {
            const caslSubject =
              privilegeCache[sbEnvironmentId] === true
                ? {
                    teamId: String(teamId),
                    sbEnvironmentId: sbEnvironmentId,
                  }
                : {
                    teamId: String(teamId),
                    sbEnvironmentId: sbEnvironmentId,
                    id: {
                      $in: [
                        '__filtered__',
                        ...[...privilegeCache[sbEnvironmentId]].map((v) => String(v)),
                      ],
                    },
                  };
            // subject('privilegeCode', caslSubject);
            userCan(privilegeCode, privilegeCode, caslSubject);
          });
        } else {
          // team-scoped privilege whose cache is the Ids type
          const privilegeCache = cache[privilegeCode];
          const caslSubject =
            privilegeCache === true
              ? {
                  teamId: String(teamId),
                }
              : {
                  teamId: String(teamId),
                  id: {
                    $in: ['__filtered__', ...[...privilegeCache].map((v) => String(v))],
                  },
                };
          // subject('privilegeCode', caslSubject);
          userCan(privilegeCode, privilegeCode, caslSubject);
        }
      }
    });
  });
  return ability;
};
