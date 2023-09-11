import 'reflect-metadata';
import { Edorg } from '@edanalytics/models-server';
import {
  addIdTo,
  cacheAccordingToPrivileges,
  cacheEdorgPrivilegesDownward,
  cacheEdorgPrivilegesUpward,
} from './helpers';
import { ITenantCache, PrivilegeCode, createEdorgCompositeNaturalKey } from '@edanalytics/models';
describe('helper: addIdTo', () => {
  const cache: ITenantCache = {};

  it('should accommodate empty initial state', () => {
    addIdTo(cache, 'tenant.sbe:read', 1);
    expect(cache).toEqual({
      'tenant.sbe:read': new Set([1]),
    });
  });
  it('should accommodate Set initial state', () => {
    addIdTo(cache, 'tenant.sbe:read', true);
    expect(cache).toEqual({
      'tenant.sbe:read': true,
    });
  });
  it('should manage SBE privileges', () => {
    addIdTo(cache, 'tenant.sbe.edorg:read', 2, 1);
    expect(cache).toEqual({
      'tenant.sbe:read': true,
      'tenant.sbe.edorg:read': {
        '1': new Set([2]),
      },
    });
  });
  it('should add ID to SBE privilege', () => {
    addIdTo(cache, 'tenant.sbe.edorg:read', 3, 1);
    expect(cache).toEqual({
      'tenant.sbe:read': true,
      'tenant.sbe.edorg:read': {
        '1': new Set([2, 3]),
      },
    });
  });
});

describe('helpers', () => {
  const cache: ITenantCache = {};
  type PartialEdorg = Pick<Edorg, 'id' | 'educationOrganizationId' | 'sbeId' | 'odsId'> & {
    children: PartialEdorg[];
  };
  const edorgTree__value: PartialEdorg = {
    id: 0,
    educationOrganizationId: 100,
    sbeId: 0,
    odsId: 0,
    children: [
      {
        id: 1,
        educationOrganizationId: 101,
        sbeId: 0,
        odsId: 0,
        children: [],
      },
      {
        id: 2,
        educationOrganizationId: 102,
        sbeId: 0,
        odsId: 0,
        children: [
          {
            id: 3,
            educationOrganizationId: 103,
            sbeId: 0,
            odsId: 0,
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
   *   - sbe 0
   *     - all vendors
   *     - all claimsets
   * - Have no access to edorg1
   */
  const edorgOwnershipPrivileges: Map<number, Set<PrivilegeCode>> = new Map();
  edorgOwnershipPrivileges.set(
    2,
    new Set([
      'tenant.sbe.edorg:read',
      'tenant.sbe.edorg.application:read',
      'tenant.sbe.edorg.application:delete',
      'tenant.sbe.vendor:read',
      'tenant.sbe.claimset:read',
      'tenant.sbe:read',
      'tenant.sbe.ods:read',
    ])
  );

  let correctCurrentCacheValue: ITenantCache = {
    'tenant.sbe.edorg:read': { '0': new Set([2, 3]) },
    'tenant.sbe.edorg.application:read': {
      '0': new Set([
        createEdorgCompositeNaturalKey({
          educationOrganizationId: 102,
          odsDbName: '',
        }),
        createEdorgCompositeNaturalKey({
          educationOrganizationId: 103,
          odsDbName: '',
        }),
      ]),
    },
    'tenant.sbe.edorg.application:delete': {
      '0': new Set([
        createEdorgCompositeNaturalKey({
          educationOrganizationId: 102,
          odsDbName: '',
        }),
        createEdorgCompositeNaturalKey({
          educationOrganizationId: 103,
          odsDbName: '',
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
    cacheEdorgPrivilegesUpward(cache, ownedEdorg, edorgOwnershipPrivileges.get(2), ownedAncestors);

    correctCurrentCacheValue = {
      ...correctCurrentCacheValue,
      'tenant.sbe:read': new Set([0]),
      'tenant.sbe.claimset:read': { '0': true },
      'tenant.sbe.vendor:read': { '0': true },
      'tenant.sbe.ods:read': { '0': new Set([0]) },
      'tenant.sbe.edorg:read': { '0': new Set([2, 3, 0]) }, // add 0.
    };

    expect(() =>
      cacheEdorgPrivilegesUpward(
        cache,
        ownedEdorg,
        new Set([
          'tenant.sbe.edorg:read',
          // MISSING 'tenant.sbe.vendor:read',
          'tenant.sbe.claimset:read',
          'tenant.sbe:read',
          'tenant.sbe.ods:read',
        ]),
        ownedAncestors
      )
    ).toThrow('Resource ownership lacks required permission tenant.sbe.vendor:read.');
    expect(cache).toEqual(correctCurrentCacheValue);
  });

  const cacheAccordingToPrivilegesCache: ITenantCache = {};
  const cacheAccordingToPrivilegesPrivileges = new Set<PrivilegeCode>([
    'me:read',
    'tenant.role:read',
    'tenant.sbe:read',
    'tenant.sbe.edorg.application:read',
    'tenant.sbe.edorg.application:delete',
    'tenant.sbe.claimset:create',
  ]);

  it('cacheAccordingToPrivileges - should add nothing if no relevant privileges', () => {
    cacheAccordingToPrivileges(
      cacheAccordingToPrivilegesCache,
      cacheAccordingToPrivilegesPrivileges,
      'tenant.sbe.vendor',
      true,
      1
    );
    expect(cacheAccordingToPrivilegesCache).toEqual({});
  });
  it('cacheAccordingToPrivileges - should add multiple privileges if present', () => {
    cacheAccordingToPrivileges(
      cacheAccordingToPrivilegesCache,
      cacheAccordingToPrivilegesPrivileges,
      'tenant.sbe.edorg.application',
      true,
      1
    );
    expect(cacheAccordingToPrivilegesCache).toEqual({
      'tenant.sbe.edorg.application:read': {
        '1': true,
      },
      'tenant.sbe.edorg.application:delete': {
        '1': true,
      },
    });
  });
  it('cacheAccordingToPrivileges - should not add invalid resources', () => {
    cacheAccordingToPrivileges(
      cacheAccordingToPrivilegesCache,
      cacheAccordingToPrivilegesPrivileges,
      'tenant.sbe.edorg.application_blahblah',
      true,
      1
    );
    expect(cacheAccordingToPrivilegesCache).toEqual({
      'tenant.sbe.edorg.application:read': {
        '1': true,
      },
      'tenant.sbe.edorg.application:delete': {
        '1': true,
      },
    });
  });
});
