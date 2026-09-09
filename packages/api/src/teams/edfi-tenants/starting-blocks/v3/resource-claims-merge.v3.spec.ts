import 'reflect-metadata';
import { GetResourceClaimDetailDtoV3, GetResourceClaimDtoV3 } from '@edanalytics/models';
import { mergeResourceClaimsV3 } from './resource-claims-merge.v3';

describe('mergeResourceClaimsV3', () => {
  it('leaves an existing (already-populated) flat resource claim list untouched when nothing is missing', () => {
    const existing: GetResourceClaimDtoV3[] = [
      {
        name: 'types',
        claimName: 'http://ed-fi.org/ods/identity/claims/domains/edFiTypes',
        parentClaimName: null,
        actions: [{ name: 'Read', enabled: true }],
        _defaultAuthorizationStrategies: [],
        authorizationStrategyOverrides: [],
      } as unknown as GetResourceClaimDtoV3,
    ];
    const detail: GetResourceClaimDetailDtoV3[] = [
      { id: 1, name: 'types', parentId: 0, parentName: null, children: [] } as unknown as GetResourceClaimDetailDtoV3,
    ];

    const result = mergeResourceClaimsV3(existing, detail);

    expect(result).toEqual(existing);
  });

  it('appends a synthesized denied entry for a child present in the detail tree but missing from the flat list, parented under the real claimName', () => {
    const existing: GetResourceClaimDtoV3[] = [
      {
        name: 'types',
        claimName: 'http://ed-fi.org/ods/identity/claims/domains/edFiTypes',
        parentClaimName: null,
        actions: [{ name: 'Read', enabled: true }],
        _defaultAuthorizationStrategies: [],
        authorizationStrategyOverrides: [],
      } as unknown as GetResourceClaimDtoV3,
    ];
    const detail: GetResourceClaimDetailDtoV3[] = [
      {
        id: 1,
        name: 'types',
        parentId: 0,
        parentName: null,
        children: [{ id: 12, name: 'schoolYearType', parentId: 1, parentName: 'types', children: [] }],
      } as unknown as GetResourceClaimDetailDtoV3,
    ];

    const result = mergeResourceClaimsV3(existing, detail);

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      name: 'schoolYearType',
      claimName: expect.any(String),
      parentClaimName: 'http://ed-fi.org/ods/identity/claims/domains/edFiTypes',
      actions: [],
      _defaultAuthorizationStrategies: [],
      authorizationStrategyOverrides: [],
    });
  });

  it('gives a synthesized entry a claimName distinct from any real claimName, and chains a missing grandchild under its missing parent', () => {
    const existing: GetResourceClaimDtoV3[] = [];
    const detail: GetResourceClaimDetailDtoV3[] = [
      {
        id: 1,
        name: 'types',
        parentId: 0,
        parentName: null,
        children: [{ id: 12, name: 'schoolYearType', parentId: 1, parentName: 'types', children: [] }],
      } as unknown as GetResourceClaimDetailDtoV3,
    ];

    const result = mergeResourceClaimsV3(existing, detail);

    expect(result).toHaveLength(2);
    const typesEntry = result.find((rc) => rc.name === 'types')!;
    const schoolYearTypeEntry = result.find((rc) => rc.name === 'schoolYearType')!;
    expect(typesEntry.parentClaimName).toBeNull();
    expect(schoolYearTypeEntry.parentClaimName).toBe(typesEntry.claimName);
    expect(schoolYearTypeEntry.claimName).not.toBe(typesEntry.claimName);
  });

  it('does not conflate same-named children in different branches (branch-safe matching)', () => {
    // Both "types" and "identity" have a child literally named "descriptor"
    // in the detail tree. "types/descriptor" already has actions;
    // "identity/descriptor" does not, so it's missing from `existing`.
    // Matching by bare name alone would incorrectly resolve
    // "identity/descriptor" to the "types" one already in the map.
    const typesClaimName = 'http://ed-fi.org/ods/identity/claims/domains/types';
    const identityClaimName = 'http://ed-fi.org/ods/identity/claims/domains/identity';
    const typesDescriptorClaimName = `${typesClaimName}/descriptor`;
    const existing: GetResourceClaimDtoV3[] = [
      {
        name: 'types',
        claimName: typesClaimName,
        parentClaimName: null,
        actions: [{ name: 'Read', enabled: true }],
        _defaultAuthorizationStrategies: [],
        authorizationStrategyOverrides: [],
      },
      {
        name: 'identity',
        claimName: identityClaimName,
        parentClaimName: null,
        actions: [{ name: 'Read', enabled: true }],
        _defaultAuthorizationStrategies: [],
        authorizationStrategyOverrides: [],
      },
      {
        name: 'descriptor',
        claimName: typesDescriptorClaimName,
        parentClaimName: typesClaimName,
        actions: [{ name: 'Read', enabled: true }],
        _defaultAuthorizationStrategies: [],
        authorizationStrategyOverrides: [],
      },
    ] as unknown as GetResourceClaimDtoV3[];
    const detail: GetResourceClaimDetailDtoV3[] = [
      {
        id: 1,
        name: 'types',
        parentId: 0,
        parentName: null,
        children: [{ id: 3, name: 'descriptor', parentId: 1, parentName: 'types', children: [] }],
      },
      {
        id: 2,
        name: 'identity',
        parentId: 0,
        parentName: null,
        children: [{ id: 4, name: 'descriptor', parentId: 2, parentName: 'identity', children: [] }],
      },
    ] as unknown as GetResourceClaimDetailDtoV3[];

    const result = mergeResourceClaimsV3(existing, detail);

    // The real types/descriptor is untouched.
    const typesDescriptor = result.find(
      (rc) => rc.name === 'descriptor' && rc.parentClaimName === typesClaimName
    );
    expect(typesDescriptor?.claimName).toBe(typesDescriptorClaimName);
    expect(typesDescriptor?.actions).toEqual([{ name: 'Read', enabled: true }]);

    // A separate, denied placeholder was added for identity/descriptor,
    // parented under identity — not merged into types/descriptor.
    const identityDescriptors = result.filter(
      (rc) => rc.name === 'descriptor' && rc.parentClaimName === identityClaimName
    );
    expect(identityDescriptors).toHaveLength(1);
    expect(identityDescriptors[0].actions).toEqual([]);
    expect(identityDescriptors[0].claimName).not.toBe(typesDescriptorClaimName);
  });

  it('reconnects an existing child of a missing parent, instead of orphaning it', () => {
    // "types" has no actions (missing from `existing`), but its child
    // "schoolYearType" does have actions and is present, already correctly
    // recorded with parentClaimName pointing at types' real claim URI.
    const typesClaimName = 'http://ed-fi.org/ods/identity/claims/domains/types';
    const existing: GetResourceClaimDtoV3[] = [
      {
        name: 'schoolYearType',
        claimName: `${typesClaimName}/schoolYearType`,
        parentClaimName: typesClaimName,
        actions: [{ name: 'Read', enabled: true }],
        _defaultAuthorizationStrategies: [],
        authorizationStrategyOverrides: [],
      },
    ] as unknown as GetResourceClaimDtoV3[];
    const detail: GetResourceClaimDetailDtoV3[] = [
      {
        id: 1,
        name: 'types',
        parentId: 0,
        parentName: null,
        children: [
          { id: 12, name: 'schoolYearType', parentId: 1, parentName: 'types', children: [] },
        ],
      },
    ] as unknown as GetResourceClaimDetailDtoV3[];

    const result = mergeResourceClaimsV3(existing, detail);

    const typesEntry = result.find((rc) => rc.name === 'types')!;
    const schoolYearTypeEntry = result.find((rc) => rc.name === 'schoolYearType')!;
    // The synthesized "types" placeholder reused the real URI recovered
    // from its existing child, rather than fabricating a new one — so the
    // pre-existing schoolYearType record still correctly nests under it.
    expect(typesEntry.claimName).toBe(typesClaimName);
    expect(schoolYearTypeEntry.parentClaimName).toBe(typesEntry.claimName);
  });
});
