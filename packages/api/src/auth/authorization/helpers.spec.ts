import 'reflect-metadata';
import { ITeamCache, PrivilegeCode, edorgCompositeKey } from '@edanalytics/models';
import { Edorg } from '@edanalytics/models-server';
import {
  addIdTo,
  cacheAccordingToPrivileges,
  cacheEdorgPrivilegesDownward,
  cacheEdorgPrivilegesUpward,
  initializeEdfiTenantPrivilegeCache,
  initializeOdsPrivilegeCache,
} from './helpers';
describe('helper: addIdTo', () => {
  const cache: ITeamCache = {};

  it('should accommodate empty initial state', () => {
    addIdTo({
      cache,
      privilege: 'team.sb-environment.edfi-tenant:read',
      id: 1,
      sbEnvironmentId: 1,
    });
    expect(cache).toEqual({
      'team.sb-environment.edfi-tenant:read': { 1: new Set([1]) },
    });
  });
  it('should accommodate Set initial state', () => {
    addIdTo({
      cache,
      privilege: 'team.sb-environment.edfi-tenant:read',
      id: true,
      sbEnvironmentId: 1,
    });
    expect(cache).toEqual({
      'team.sb-environment.edfi-tenant:read': { 1: true },
    });
  });
  it('should manage EdfiTenant privileges', () => {
    addIdTo({
      cache,
      privilege: 'team.sb-environment.edfi-tenant.ods.edorg:read',
      id: 2,
      edfiTenantId: 1,
    });
    expect(cache).toEqual({
      'team.sb-environment.edfi-tenant:read': { 1: true },
      'team.sb-environment.edfi-tenant.ods.edorg:read': {
        '1': new Set([2]),
      },
    });
  });
  it('should add ID to EdfiTenant privilege', () => {
    addIdTo({
      cache,
      privilege: 'team.sb-environment.edfi-tenant.ods.edorg:read',
      id: 3,
      edfiTenantId: 1,
    });
    expect(cache).toEqual({
      'team.sb-environment.edfi-tenant:read': { 1: true },
      'team.sb-environment.edfi-tenant.ods.edorg:read': {
        '1': new Set([2, 3]),
      },
    });
  });
});

describe('initializeEdfiTenantPrivilegeCache', () => {
  it('should apply privilege edfi-tenant-wide', () => {
    const edfiTenantId = 3;
    const ods = { id: 15, edfiTenantId: 1 };
    const correctCurrentCacheValue: ITeamCache = {
      'team.sb-environment.edfi-tenant.ods:read': {
        /** Wholly owned EdfiTenant `edfiTenantId` */
        [edfiTenantId]: true,
        /** Individual ODS owned in EdfiTenant `ods.edfiTenantId` */
        [ods.edfiTenantId]: new Set([ods.id]),
      },
    };
    const cache: ITeamCache = {};
    initializeEdfiTenantPrivilegeCache(
      cache,
      new Set(['team.sb-environment.edfi-tenant.ods:read']),
      edfiTenantId
    );
    cacheAccordingToPrivileges({
      cache,
      privileges: new Set(['team.sb-environment.edfi-tenant.ods:read']),
      resource: 'team.sb-environment.edfi-tenant.ods',
      id: ods.id,
      edfiTenantId: ods.edfiTenantId,
    });
    expect(cache).toEqual(correctCurrentCacheValue);
  });
  it('should overwrite existing lesser privileges', () => {
    const edfiTenantId = 3;
    const ods = { id: 15, edfiTenantId: 1 };
    const correctCurrentCacheValue: ITeamCache = {
      'team.sb-environment.edfi-tenant.ods:read': {
        /** Wholly owned EdfiTenant `edfiTenantId` */
        [edfiTenantId]: true,
        /** Individual ODS owned in EdfiTenant `ods.edfiTenantId` */
        [ods.edfiTenantId]: new Set([ods.id]),
      },
    };
    const cache: ITeamCache = {
      'team.sb-environment.edfi-tenant.ods:read': {
        [edfiTenantId]: new Set(),
      },
    };
    initializeEdfiTenantPrivilegeCache(
      cache,
      new Set(['team.sb-environment.edfi-tenant.ods:read']),
      edfiTenantId
    );
    cacheAccordingToPrivileges({
      cache,
      privileges: new Set(['team.sb-environment.edfi-tenant.ods:read']),
      resource: 'team.sb-environment.edfi-tenant.ods',
      id: ods.id,
      edfiTenantId: ods.edfiTenantId,
    });
    expect(cache).toEqual(correctCurrentCacheValue);
  });
});
describe('initializeOdsPrivilegeCache', () => {
  it('should add empty set', () => {
    const edfiTenantId = 3;
    const ods = { edfiTenantId: 1 };
    const correctCurrentCacheValue: ITeamCache = {
      'team.sb-environment.edfi-tenant.ods.edorg:read': {
        /** Wholly owned EdfiTenant `edfiTenantId` */
        [edfiTenantId]: true,
        /** Individual ODS owned in EdfiTenant `ods.edfiTenantId` */
        [ods.edfiTenantId]: new Set([]),
      },
    };
    const cache: ITeamCache = {};
    initializeEdfiTenantPrivilegeCache(
      cache,
      new Set(['team.sb-environment.edfi-tenant.ods.edorg:read']),
      edfiTenantId
    );
    initializeOdsPrivilegeCache(
      cache,
      new Set(['team.sb-environment.edfi-tenant.ods.edorg:read']),
      ods.edfiTenantId
    );
    expect(cache).toEqual(correctCurrentCacheValue);
  });
  it('should not overwrite greater existing privilege', () => {
    const edfiTenantId = 1;
    const ods = { edfiTenantId: 1 };
    const correctCurrentCacheValue: ITeamCache = {
      'team.sb-environment.edfi-tenant.ods.edorg:read': {
        /** Wholly owned EdfiTenant `edfiTenantId` */
        [edfiTenantId]: true,
      },
    };
    const cache: ITeamCache = {};
    initializeEdfiTenantPrivilegeCache(
      cache,
      new Set(['team.sb-environment.edfi-tenant.ods.edorg:read']),
      edfiTenantId
    );
    initializeOdsPrivilegeCache(
      cache,
      new Set(['team.sb-environment.edfi-tenant.ods.edorg:read']),
      ods.edfiTenantId
    );
    expect(cache).toEqual(correctCurrentCacheValue);
  });
});

describe('helpers', () => {
  const cache: ITeamCache = {};
  type PartialEdorg = Pick<
    Edorg,
    'id' | 'educationOrganizationId' | 'edfiTenantId' | 'odsId' | 'odsDbName' | 'odsInstanceId'
  > & {
    children: PartialEdorg[];
  };
  const edorgTree__value: PartialEdorg = {
    id: 0,
    educationOrganizationId: 100,
    edfiTenantId: 0,
    odsId: 0,
    odsDbName: 'ods_db',
    odsInstanceId: null,
    children: [
      {
        id: 1,
        educationOrganizationId: 101,
        edfiTenantId: 0,
        odsId: 0,
        odsDbName: 'ods_db',
        odsInstanceId: null,
        children: [],
      },
      {
        id: 2,
        educationOrganizationId: 102,
        edfiTenantId: 0,
        odsId: 0,
        odsDbName: 'ods_db',
        odsInstanceId: null,
        children: [
          {
            id: 3,
            educationOrganizationId: 103,
            edfiTenantId: 0,
            odsId: 0,
            odsDbName: 'ods_db',
            odsInstanceId: null,
            children: [],
          },
        ],
      },
    ],
  };
  const edorgTree = edorgTree__value as Edorg;
  const ownedEdorg = edorgTree.children[1];
  const ownedAncestors = [edorgTree];

  /**
   * We own edorg2. This means that we:
   * - Get all owned privileges on edorg 2, plus:
   *   - applications for edorg2
   * - Inherit all owned privileges downward to edorg 3, plus:
   *   - applications for edorg3
   * - Inherit read-only privileges upward to:
   *   - edorg 0
   *   - ods 0
   *   - edfiTenant 0
   *     - all vendors
   *     - all claimsets
   * - Have no access to edorg1
   */
  const edorgOwnershipPrivileges: Map<number, Set<PrivilegeCode>> = new Map();
  edorgOwnershipPrivileges.set(
    2,
    new Set([
      'team.sb-environment.edfi-tenant.ods.edorg:read',
      'team.sb-environment.edfi-tenant.ods.edorg.application:read',
      'team.sb-environment.edfi-tenant.ods.edorg.application:delete',
      'team.sb-environment.edfi-tenant.vendor:read',
      'team.sb-environment.edfi-tenant.profile:read',
      'team.sb-environment.edfi-tenant.claimset:read',
      'team.sb-environment.edfi-tenant:read',
      'team.sb-environment.edfi-tenant.ods:read',
      'team.sb-environment:read',
    ])
  );
  let correctCurrentCacheValue: ITeamCache = {
    'team.sb-environment.edfi-tenant.ods.edorg:read': { '0': new Set([2, 3]) },
    'team.sb-environment.edfi-tenant.ods.edorg.application:read': {
      '0': new Set([
        edorgCompositeKey({
          edorg: 102,
          ods: 'ods_db',
        }),
        edorgCompositeKey({
          edorg: 103,
          ods: 'ods_db',
        }),
      ]),
    },
    'team.sb-environment.edfi-tenant.ods.edorg.application:delete': {
      '0': new Set([
        edorgCompositeKey({
          edorg: 102,
          ods: 'ods_db',
        }),
        edorgCompositeKey({
          edorg: 103,
          ods: 'ods_db',
        }),
      ]),
    },
    'team.sb-environment.edfi-tenant.claimset:read': {
      '0': new Set([
        edorgCompositeKey({
          edorg: 102,
          ods: 'ods_db',
        }),
        edorgCompositeKey({
          edorg: 103,
          ods: 'ods_db',
        }),
      ]),
    },
    'team.sb-environment.edfi-tenant.profile:read': {
      '0': new Set([
        edorgCompositeKey({
          edorg: 102,
          ods: 'ods_db',
        }),
        edorgCompositeKey({
          edorg: 103,
          ods: 'ods_db',
        }),
      ]),
    },
    'team.sb-environment.edfi-tenant.vendor:read': {
      '0': new Set([
        edorgCompositeKey({
          edorg: 102,
          ods: 'ods_db',
        }),
        edorgCompositeKey({
          edorg: 103,
          ods: 'ods_db',
        }),
      ]),
    },
  };
  it('cacheEdorgPrivilegesDownward - should cache downward but not upward', () => {
    cacheEdorgPrivilegesDownward(
      cache,
      new Set([] as PrivilegeCode[]),
      edorgTree,
      edorgOwnershipPrivileges
    );
    expect(cache).toEqual(correctCurrentCacheValue);
  });
  it('cacheEdorgPrivilegesUpward - should error on missing minimum privileges', () => {
    cacheEdorgPrivilegesUpward({
      cache,
      edorg: ownedEdorg,
      ownedPrivileges: edorgOwnershipPrivileges.get(2)!,
      ancestors: ownedAncestors,
      edfiTenant: { sbEnvironmentId: 1 },
    });

    correctCurrentCacheValue = {
      ...correctCurrentCacheValue,
      'team.sb-environment:read': new Set([1]),
      'team.sb-environment.edfi-tenant:read': { 1: new Set([0]) },
      'team.sb-environment.edfi-tenant.claimset:read': { '0': true },
      'team.sb-environment.edfi-tenant.vendor:read': { '0': true },
      'team.sb-environment.edfi-tenant.profile:read': { '0': true },
      'team.sb-environment.edfi-tenant.ods:read': { '0': new Set([0]) },
      'team.sb-environment.edfi-tenant.ods.edorg:read': { '0': new Set([2, 3, 0]) }, // add 0.
    };

    expect(() =>
      cacheEdorgPrivilegesUpward({
        cache,
        edorg: ownedEdorg,
        ownedPrivileges: new Set([
          'team.sb-environment.edfi-tenant.ods.edorg:read',
          // MISSING 'team.sb-environment.edfi-tenant.vendor:read',
          'team.sb-environment.edfi-tenant.claimset:read',
          'team.sb-environment.edfi-tenant:read',
          // 'team.sb-environment:read',
          'team.sb-environment.edfi-tenant.ods:read',
        ]),
        ancestors: ownedAncestors,
        edfiTenant: { sbEnvironmentId: 1 },
      })
    ).toThrow();
    expect(cache).toEqual(correctCurrentCacheValue);
  });

  const cacheAccordingToPrivilegesCache: ITeamCache = {};
  const cacheAccordingToPrivilegesPrivileges = new Set<PrivilegeCode>([
    'me:read',
    'team.role:read',
    'team.sb-environment.edfi-tenant:read',
    'team.sb-environment.edfi-tenant.ods.edorg.application:read',
    'team.sb-environment.edfi-tenant.ods.edorg.application:delete',
    'team.sb-environment.edfi-tenant.claimset:create',
  ]);

  it('cacheAccordingToPrivileges - should add nothing if no relevant privileges', () => {
    cacheAccordingToPrivileges({
      cache: cacheAccordingToPrivilegesCache,
      privileges: cacheAccordingToPrivilegesPrivileges,
      resource: 'team.sb-environment.edfi-tenant.vendor',
      id: true,
      edfiTenantId: 1,
    });
    expect(cacheAccordingToPrivilegesCache).toEqual({});
  });
  it('cacheAccordingToPrivileges - should add multiple privileges if present', () => {
    cacheAccordingToPrivileges({
      cache: cacheAccordingToPrivilegesCache,
      privileges: cacheAccordingToPrivilegesPrivileges,
      resource: 'team.sb-environment.edfi-tenant.ods.edorg.application',
      id: true,
      edfiTenantId: 1,
    });
    expect(cacheAccordingToPrivilegesCache).toEqual({
      'team.sb-environment.edfi-tenant.ods.edorg.application:read': {
        '1': true,
      },
      'team.sb-environment.edfi-tenant.ods.edorg.application:delete': {
        '1': true,
      },
    });
  });
  it('cacheAccordingToPrivileges - should not add invalid resources', () => {
    expect(() =>
      cacheAccordingToPrivileges({
        cache: cacheAccordingToPrivilegesCache,
        privileges: cacheAccordingToPrivilegesPrivileges,
        resource: 'team.sb-environment.edfi-tenant.ods.edorg.application_blahblah',
        id: true,
        edfiTenantId: 1,
      })
    ).toThrow();
  });
});
