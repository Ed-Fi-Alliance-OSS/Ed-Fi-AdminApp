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
});
