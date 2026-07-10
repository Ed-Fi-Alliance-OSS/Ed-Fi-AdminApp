import 'reflect-metadata';
import {
  GetApiClientDtoV3,
  GetDataStoreDetailDtoV3,
  GetDataStoreSummaryDtoV3,
  toGetApiClientDtoV3,
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
});
