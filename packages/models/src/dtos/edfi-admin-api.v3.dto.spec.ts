import 'reflect-metadata';
import {
  GetApiClientDtoV3,
  GetClaimsetMultipleDtoV3,
  GetClaimsetSingleDtoV3,
  GetDataStoreDetailDtoV3,
  GetDataStoreSummaryDtoV3,
  toGetApiClientDtoV3,
  toGetClaimsetMultipleDtoV3,
  toGetClaimsetSingleDtoV3,
  toGetDataStoreDetailDtoV3,
  toGetDataStoreSummaryDtoV3,
} from './edfi-admin-api.v3.dto';

describe('edfi-admin-api.v3.dto', () => {
  it('serializes GetDataStoreSummaryDtoV3 using dataStoreType (not instanceType)', () => {
    const raw = { id: 1, name: 'Ods1', dataStoreType: 'Ods' };
    const result = toGetDataStoreSummaryDtoV3(raw);

    expect(result).toBeInstanceOf(GetDataStoreSummaryDtoV3);
    expect(result.dataStoreType).toBe('Ods');
  });

  it('serializes GetApiClientDtoV3 using dataStoreIds (not odsInstanceIds)', () => {
    const raw = {
      id: 1,
      name: 'client',
      key: 'key',
      isApproved: true,
      useSandbox: false,
      sandboxType: 0,
      applicationId: 2,
      keyStatus: 'Active',
      dataStoreIds: [10, 20],
    };
    const result = toGetApiClientDtoV3(raw);

    expect(result).toBeInstanceOf(GetApiClientDtoV3);
    expect(result.dataStoreIds).toEqual([10, 20]);
    expect(result.displayName).toBe('client');
  });

  it('serializes nested GetDataStoreDetailDtoV3 contexts/derivatives under renamed keys', () => {
    const raw = {
      id: 1,
      name: 'Ods1',
      dataStoreType: 'Ods',
      dataStoreContexts: [{ id: 5, dataStoreId: 1, contextKey: 'k', contextValue: 'v' }],
      dataStoreDerivatives: [{ id: 6, dataStoreId: 1, derivativeType: 'ReadReplica' }],
    };
    const result = toGetDataStoreDetailDtoV3(raw);

    expect(result).toBeInstanceOf(GetDataStoreDetailDtoV3);
    expect(result.dataStoreContexts[0].dataStoreId).toBe(1);
    expect(result.dataStoreDerivatives[0].derivativeType).toBe('ReadReplica');
  });

  it('serializes GetClaimsetMultipleDtoV3 using claimSetName (not name) from the wire', () => {
    const raw = {
      id: 1,
      claimSetName: 'SIS Vendor',
      _isSystemReserved: true,
      _applications: [{ applicationName: 'Test Application' }],
    };
    const result = toGetClaimsetMultipleDtoV3(raw);

    expect(result).toBeInstanceOf(GetClaimsetMultipleDtoV3);
    expect(result.name).toBe('SIS Vendor');
    expect(result.displayName).toBe('SIS Vendor');
    expect(result.applicationsCount).toBe(1);
  });

  it('serializes GetClaimsetSingleDtoV3 resourceClaims as a flat list with claimName/parentClaimName', () => {
    const raw = {
      id: 1,
      claimSetName: 'SIS Vendor',
      _isSystemReserved: true,
      _applications: [],
      resourceClaims: [
        {
          name: 'managedDescriptors',
          claimName: 'http://ed-fi.org/ods/identity/claims/domains/managedDescriptors',
          parentClaimName: null,
          actions: [{ name: 'Create', enabled: true }],
          _defaultAuthorizationStrategies: [
            { actionName: 'Create', authorizationStrategies: [{ authStrategyName: 'NamespaceBased' }] },
          ],
          authorizationStrategyOverrides: [],
        },
        {
          name: 'school',
          claimName: 'http://ed-fi.org/identity/claims/ed-fi/school',
          parentClaimName: 'http://ed-fi.org/ods/identity/claims/domains/managedDescriptors',
          actions: [{ name: 'Read', enabled: true }],
          _defaultAuthorizationStrategies: [],
          authorizationStrategyOverrides: [
            { actionName: 'Read', authorizationStrategies: [{ authStrategyName: 'NoFurtherAuthorizationRequired' }] },
          ],
        },
      ],
    };
    const result = toGetClaimsetSingleDtoV3(raw);

    expect(result).toBeInstanceOf(GetClaimsetSingleDtoV3);
    expect(result.resourceClaims).toHaveLength(2);
    expect(result.resourceClaims[0].claimName).toBe(
      'http://ed-fi.org/ods/identity/claims/domains/managedDescriptors'
    );
    expect(result.resourceClaims[1].parentClaimName).toBe(
      'http://ed-fi.org/ods/identity/claims/domains/managedDescriptors'
    );
    expect(result.resourceClaims[1].authorizationStrategyOverrides[0].authorizationStrategies[0].authStrategyName).toBe(
      'NoFurtherAuthorizationRequired'
    );
    // Fields removed in V3 must not survive serialization onto the instance.
    expect((result.resourceClaims[0] as unknown as { id?: unknown }).id).toBeUndefined();
    expect((result.resourceClaims[0] as unknown as { children?: unknown }).children).toBeUndefined();
  });
});
