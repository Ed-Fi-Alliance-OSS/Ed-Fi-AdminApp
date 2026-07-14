import 'reflect-metadata';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { AdminApiServiceV3 } from './admin-api.v3.service';

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('AdminApiServiceV3', () => {
  let service: AdminApiServiceV3;

  const mockEdfiTenant: Partial<EdfiTenant> = {
    id: 1,
    name: 'test-tenant',
    sbEnvironment: {
      id: 1,
      name: 'Test Environment',
      adminApiUrl: 'https://api.test.com',
    } as SbEnvironment,
  };

  beforeEach(() => {
    service = new AdminApiServiceV3();
  });

  describe('login', () => {
    const mockSbEnvironment: Partial<SbEnvironment> = {
      id: 1,
      name: 'Test Environment',
      adminApiUrl: 'https://api.test.com',
      configPublic: {
        version: 'v3',
        values: {
          tenants: {
            'test-tenant': { adminApiKey: 'test-key' },
          },
        },
      } as any,
      configPrivate: {
        tenants: {
          'test-tenant': { adminApiSecret: 'test-secret' },
        },
      } as any,
    };

    it('returns NO_CONFIG when configPublic.version is not v3', async () => {
      const environment = {
        ...mockSbEnvironment,
        configPublic: { version: 'v2', values: {} } as any,
      } as SbEnvironment;

      const result = await service.login(environment, 1, 'test-tenant');

      expect(result).toEqual({ status: 'NO_CONFIG' });
    });

    it('returns NO_TENANT_CONFIG when the requested tenant has no credentials', async () => {
      const environment = mockSbEnvironment as SbEnvironment;

      const result = await service.login(environment, 1, 'unknown-tenant');

      expect(result).toEqual({ status: 'NO_TENANT_CONFIG' });
    });
  });

  describe('initializeApiClient', () => {
    it('creates an axios client with a /v3/ baseURL', () => {
      const client = (service as any).initializeApiClient(
        { adminApiUrl: 'https://api.test.com' } as SbEnvironment,
        false,
      );

      expect(client.defaults.baseURL).toBe('https://api.test.com/v3/');
    });
  });

  describe('getVendors', () => {
    it('returns vendors mapped through the V3 DTO serializer', async () => {
      const mockGet = jest
        .fn()
        .mockResolvedValue([
          {
            id: 1,
            company: 'Acme',
            contactName: 'Jane',
            contactEmailAddress: 'jane@acme.com',
            namespacePrefixes: '',
          },
        ]);
      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({ get: mockGet });

      const result = await service.getVendors(mockEdfiTenant as EdfiTenant);

      expect(mockGet).toHaveBeenCalledWith('vendors?offset=0&limit=10000');
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Acme');
    });
  });

  describe('postVendor', () => {
    it('returns the new vendor id parsed from the Location header', async () => {
      const mockPost = jest
        .fn()
        .mockResolvedValue({ headers: { location: 'https://api.test.com/v3/vendors/42' } });
      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({ post: mockPost });

      const result = await service.postVendor(
        mockEdfiTenant as EdfiTenant,
        {
          company: 'Acme',
        } as any,
      );

      expect(mockPost).toHaveBeenCalledWith('vendors', { company: 'Acme' });
      expect(result).toEqual({ id: 42 });
    });
  });

  describe('getApplications', () => {
    it('returns applications with dataStoreIds populated', async () => {
      const mockGet = jest.fn().mockResolvedValue([
        {
          id: 1,
          applicationName: 'App1',
          vendorId: 1,
          claimSetName: 'Default',
          profileIds: [],
          educationOrganizationIds: [255901],
          dataStoreIds: [10],
        },
      ]);
      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({ get: mockGet });

      const result = await service.getApplications(mockEdfiTenant as EdfiTenant);

      expect(mockGet).toHaveBeenCalledWith('applications?offset=0&limit=10000');
      expect(result[0].dataStoreIds).toEqual([10]);
    });
  });

  describe('getApiClients', () => {
    it('requests apiclients filtered by applicationId and returns dataStoreIds', async () => {
      const mockGet = jest.fn().mockResolvedValue([
        {
          id: 1,
          name: 'client',
          key: 'key',
          isApproved: true,
          useSandbox: false,
          sandboxType: 0,
          applicationId: 5,
          keyStatus: 'Active',
          dataStoreIds: [10],
        },
      ]);
      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({ get: mockGet });

      const result = await service.getApiClients(mockEdfiTenant as EdfiTenant, 5);

      expect(mockGet).toHaveBeenCalledWith('apiclients?offset=0&limit=10000&applicationId=5');
      expect(result[0].dataStoreIds).toEqual([10]);
    });
  });

  describe('getClaimsets', () => {
    it('returns claimsets mapped through the V3 DTO serializer', async () => {
      const mockGet = jest
        .fn()
        .mockResolvedValue([
          { id: 1, name: 'Default', _isSystemReserved: true, _applications: [] },
        ]);
      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({ get: mockGet });

      const result = await service.getClaimsets(mockEdfiTenant as EdfiTenant);

      expect(mockGet).toHaveBeenCalledWith('claimSets?offset=0&limit=10000');
      expect(result[0].displayName).toBe('Default');
    });
  });

  describe('copyClaimset', () => {
    it('parses the new claimset id from the Location header', async () => {
      const mockPost = jest
        .fn()
        .mockResolvedValue({ headers: { location: 'https://api.test.com/v3/claimSets/99' } });
      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({ post: mockPost });

      const result = await service.copyClaimset(mockEdfiTenant as EdfiTenant, {
        originalId: 1,
        name: 'Copy',
      });

      expect(mockPost).toHaveBeenCalledWith('claimSets/copy', { originalId: 1, name: 'Copy' });
      expect(result.id).toBe(99);
    });
  });

  describe('getDataStores', () => {
    it('requests the dataStores route and returns dataStoreType', async () => {
      const mockGet = jest.fn().mockResolvedValue([{ id: 1, name: 'Ods1', dataStoreType: 'Ods' }]);
      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({ get: mockGet });

      const result = await service.getDataStores(mockEdfiTenant as EdfiTenant);

      expect(mockGet).toHaveBeenCalledWith('dataStores?offset=0&limit=10000');
      expect(result[0].dataStoreType).toBe('Ods');
    });
  });

  describe('getProfiles', () => {
    it('returns profiles mapped through the V3 DTO serializer', async () => {
      const mockGet = jest
        .fn()
        .mockResolvedValue([{ id: 1, name: 'Profile1', definition: '<a/>' }]);
      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({ get: mockGet });

      const result = await service.getProfiles(mockEdfiTenant as EdfiTenant);

      expect(mockGet).toHaveBeenCalledWith('profiles?offset=0&limit=10000');
      expect(result[0].displayName).toBe('Profile1');
    });
  });

  describe('deleteVendor', () => {
    it('calls delete on the correct route and returns undefined', async () => {
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({ delete: mockDelete });

      const result = await service.deleteVendor(mockEdfiTenant as EdfiTenant, 7);

      expect(mockDelete).toHaveBeenCalledWith('vendors/7');
      expect(result).toBeUndefined();
    });
  });
});
