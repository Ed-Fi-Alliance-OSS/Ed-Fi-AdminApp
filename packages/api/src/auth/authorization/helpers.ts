import { defineAbility, subject } from '@casl/ability';
import {
  TenantSbePrivilege,
  PrivilegeCode,
  TenantBasePrivilege,
  BasePrivilege,
  ITenantCache,
  SpecificIds,
  TrueValue,
  isSbePrivilege,
  BasePrivilegeResourceType,
  PrivilegeResource,
  SbePrivilegeResourceType,
  baseResourcePrivilegesMap,
  sbeResourcePrivilegesMap,
  trueOnlyPrivileges,
  upwardInheritancePrivileges,
  minimumPrivileges,
  AuthorizationCache,
  Ids,
  isGlobalPrivilege,
  sbeTenantPrivilegesMap,
} from '@edanalytics/models';
import { Edorg } from '@edanalytics/models-server';
import { createEdorgCompositeNaturalKey } from '@edanalytics/models';

/**
 * Add a resource ID into the cache of IDs allowable for a specific privilege.
 *
 * @param cache cache to mutate
 * @param privilege privilege against which to cache the id
 * @param id id to cache
 */
export function addIdTo(
  cache: ITenantCache,
  privilege: TenantBasePrivilege,
  id: number | string | TrueValue
): void;
/**
 * Add a resource ID into the cache of IDs allowable for a specific privilege.
 *
 * @param cache cache to mutate
 * @param privilege privilege against which to cache the id
 * @param id id to cache
 * @param sbeId id of the SBE which owns this resource
 */
export function addIdTo(
  cache: ITenantCache,
  privilege: TenantSbePrivilege,
  id: number | string | TrueValue,
  sbeId: number
): void;
export function addIdTo(
  cache: ITenantCache,
  privilege: TenantBasePrivilege | TenantSbePrivilege,
  id: number | string | TrueValue,
  sbeId?: number
): void {
  if (isSbePrivilege(privilege)) {
    if (cache[privilege] === undefined) {
      cache[privilege] = {};
    }
    if (cache[privilege][sbeId] !== true) {
      if (id !== true && !trueOnlyPrivileges.has(privilege)) {
        if (cache[privilege][sbeId] === undefined) {
          cache[privilege][sbeId] = new Set([id]);
        } else {
          (cache[privilege][sbeId] as SpecificIds).add(id);
        }
      } else {
        cache[privilege][sbeId] = true;
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
export function cacheAccordingToPrivileges(
  cache: ITenantCache,
  privileges: Set<PrivilegeCode | TenantBasePrivilege | TenantSbePrivilege>,
  resource: BasePrivilegeResourceType,
  id: number | string | TrueValue
);
/**
 * Cache a resource's ID (or a blanket `true`) against all relevant
 * privileges, if any are present. If no relevant privileges have
 * been granted, no action is taken.
 *
 * @param cache cache to mutate
 * @param privileges all granted privileges, or at least all relevant ones
 * @param resource resource type
 * @param id id to cache
 * @param sbeId id of the SBE which owns the resource
 */
export function cacheAccordingToPrivileges(
  cache: ITenantCache,
  privileges: Set<PrivilegeCode | TenantBasePrivilege | TenantSbePrivilege>,
  resource: SbePrivilegeResourceType,
  id: number | string | TrueValue,
  sbeId: number
);
export function cacheAccordingToPrivileges(
  cache: ITenantCache,
  privileges: Set<PrivilegeCode | TenantBasePrivilege | TenantSbePrivilege>,
  resource: PrivilegeResource,
  id: number | string | TrueValue,
  sbeId?: number
) {
  if (resource in baseResourcePrivilegesMap) {
    baseResourcePrivilegesMap[resource]?.forEach((possiblePrivilege) => {
      if (privileges.has(possiblePrivilege)) {
        const idToCache = trueOnlyPrivileges.has(possiblePrivilege) ? true : id;
        addIdTo(cache, possiblePrivilege, idToCache);
      }
    });
  } else {
    sbeResourcePrivilegesMap[resource]?.forEach((possiblePrivilege) => {
      if (privileges.has(possiblePrivilege)) {
        const idToCache = trueOnlyPrivileges.has(possiblePrivilege) ? true : id;
        addIdTo(cache, possiblePrivilege, idToCache, sbeId);
      }
    });
  }
}

/**
 * Initialize all relevant sbe-level privilege caches to a blanket `true`
 *
 * */
export function initializeSbePrivilegeCache(
  cache: ITenantCache,
  privileges: Set<PrivilegeCode>,
  sbeId: number
) {
  Object.keys(sbeTenantPrivilegesMap).forEach((sbeTenantPrivilege: PrivilegeCode) => {
    if (privileges.has(sbeTenantPrivilege)) {
      if (!(sbeTenantPrivilege in cache)) {
        cache[sbeTenantPrivilege] = {};
      }
      cache[sbeTenantPrivilege][sbeId] = true;
    }
  });
}
/**
 * Initialize all relevant ods-inherited privilege caches to an empty set
 *
 * This uses an empty set whereas the sbe version uses a
 * blanket `true`. The difference is that the sbe-level ones
 * are actually executed at the sbe level, so the cache value
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
  cache: ITenantCache,
  privileges: Set<PrivilegeCode>,
  sbeId: number
) {
  // these are the privileges that are inherited from ODS ownership
  const allOdsPrivileges: PrivilegeCode[] = [
    'tenant.sbe.edorg.application:create',
    'tenant.sbe.edorg.application:read',
    'tenant.sbe.edorg.application:update',
    'tenant.sbe.edorg.application:delete',
    'tenant.sbe.edorg.application:reset-credentials',
    'tenant.sbe.edorg:read',
  ];

  allOdsPrivileges.forEach((odsTenantPrivilege: PrivilegeCode) => {
    if (privileges.has(odsTenantPrivilege)) {
      if (!(odsTenantPrivilege in cache)) {
        cache[odsTenantPrivilege] = {};
      }
      if (!(String(sbeId) in cache[odsTenantPrivilege])) {
        cache[odsTenantPrivilege][sbeId] = new Set();
      }
    }
  });
}

/** Initialize empty-but-present privilege caches for a tenant's base (not Sbe-child) privileges */
export function initializeBasePrivilegeCache(cache: ITenantCache, privileges: Set<PrivilegeCode>) {
  Object.keys(sbeTenantPrivilegesMap).forEach((sbeTenantPrivilege: PrivilegeCode) => {
    if (privileges.has(sbeTenantPrivilege)) {
      if (!(sbeTenantPrivilege in cache)) {
        cache[sbeTenantPrivilege] = new Set();
      }
    }
  });
}

/**
 * Climb down the Edorg tree and cache the IDs against the weakly-increasing privilege set. This does _NOT_ do anything about _upward_ inheritance.
 */
export const cacheEdorgPrivilegesDownward = (
  cache: ITenantCache,
  initialPrivileges: Set<PrivilegeCode>,
  edorg: Pick<Edorg, 'id' | 'children' | 'sbeId' | 'odsDbName' | 'educationOrganizationId'>,
  edorgOwnershipPrivileges: Map<number, Set<PrivilegeCode>>
) => {
  const myPrivileges = new Set(initialPrivileges.values()); // so the other ODS's iterations use SBE's original privileges
  const ownership = edorgOwnershipPrivileges.get(edorg.id);
  if (ownership) {
    [...ownership.values()].forEach((p) => myPrivileges.add(p));
  }
  cacheAccordingToPrivileges(cache, myPrivileges, 'tenant.sbe.edorg', edorg.id, edorg.sbeId);
  const compositeKey = createEdorgCompositeNaturalKey({
    odsDbName: edorg.odsDbName,
    educationOrganizationId: edorg.educationOrganizationId,
  });
  cacheAccordingToPrivileges(
    cache,
    myPrivileges,
    'tenant.sbe.edorg.application',
    compositeKey,
    edorg.sbeId
  );
  edorg.children?.forEach((childEdorg) =>
    cacheEdorgPrivilegesDownward(cache, myPrivileges, childEdorg, edorgOwnershipPrivileges)
  );
};

/**
 * Apply privileges from an edorg ownership to its edorg, ods, sbe, vendor, and claimset _ancestors_. Does _NOT_ climb _down_ the edorg tree.
 *
 * Checks that the supplied privileges include the minimum set, but only applies that minimum &mdash; no _extra_ privileges can be inherited upward.
 */
export const cacheEdorgPrivilegesUpward = (
  cache: ITenantCache,
  edorg: Edorg,
  /** Privileges to apply.
   *
   *  This is a possibly-TBD question of business rules. But we _probably_ don't want it to be possible for an ownership of a leaf entity to grant any more than the minimum default access to its parent trunk entities.
   * */
  ownedPrivileges: Set<PrivilegeCode>,
  ancestors: Edorg[]
) => {
  [...upwardInheritancePrivileges].forEach((mp) => {
    if (!ownedPrivileges.has(mp)) {
      throw new Error(`Resource ownership lacks required permission ${mp}.`);
    }
  });
  ancestors.forEach((ancestorEdorg) => {
    cacheAccordingToPrivileges(
      cache,
      upwardInheritancePrivileges,
      'tenant.sbe.edorg',
      ancestorEdorg.id,
      ancestorEdorg.sbeId
    );
  });
  cacheAccordingToPrivileges(
    cache,
    upwardInheritancePrivileges,
    'tenant.sbe.ods',
    edorg.odsId,
    edorg.sbeId
  );
  cacheAccordingToPrivileges(
    cache,
    upwardInheritancePrivileges,
    'tenant.sbe.claimset',
    true,
    edorg.sbeId
  );
  cacheAccordingToPrivileges(
    cache,
    upwardInheritancePrivileges,
    'tenant.sbe.vendor',
    true,
    edorg.sbeId
  );
  cacheAccordingToPrivileges(cache, upwardInheritancePrivileges, 'tenant.sbe', edorg.sbeId);
};

/**
 * Turn the cachable resource ownership and privilege structure into a CASL ability.
 *
 * @param cache The object containing the union of the user's global privileges and the user-filtered tenant privileges.
 * @param tenantId ID of the tenant
 * @returns CASL ability
 */
export const abilityFromCache = (
  cache: AuthorizationCache,
  tenantId: number | string | undefined
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
        // tenant-scoped privilege
        if (tenantId === undefined || tenantId === 'undefined') {
          throw new Error('Attempting to construct tenant ability but no tenantID provided.');
        }

        if (isSbePrivilege(privilegeCode)) {
          // tenant-scoped privilege whose cache is a map of sbes to the Ids type
          const privilegeCache = cache[privilegeCode];
          const sbeIds = Object.keys(privilegeCache);
          sbeIds.forEach((sbeId) => {
            const caslSubject =
              privilegeCache[sbeId] === true
                ? {
                    tenantId: String(tenantId),
                    sbeId: sbeId,
                  }
                : {
                    tenantId: String(tenantId),
                    sbeId: sbeId,
                    id: {
                      $in: ['__filtered__', ...[...privilegeCache[sbeId]].map((v) => String(v))],
                    },
                  };
            // subject('privilegeCode', caslSubject);
            userCan(privilegeCode, privilegeCode, caslSubject);
          });
        } else {
          // tenant-scoped privilege whose cache is the Ids type
          const privilegeCache = cache[privilegeCode];
          const caslSubject =
            privilegeCache === true
              ? {
                  tenantId: String(tenantId),
                }
              : {
                  tenantId: String(tenantId),
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
