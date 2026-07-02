import 'reflect-metadata';
import { SbEnvironment } from '@edanalytics/models-server';
import { AdminApiServiceV1 } from './admin-api.v1.service';
import { AxiosError } from 'axios';

describe('AdminApiServiceV1 - Extension Methods', () => {
  let service: AdminApiServiceV1;

  const mockSbEnvironment: Partial<SbEnvironment> = {
    id: 1,
    name: 'Test Environment',
    adminApiUrl: 'https://api.test.com',
    configPublic: {
      version: 'v1',
      values: {
        edfiHostname: 'test.edfi.org',
        adminApiUrl: 'https://api.test.com',
        adminApiKey: 'test-key',
        adminApiClientDisplayName: 'Test Client',
      },
      adminApiUrl: 'https://api.test.com',
      adminApiVersion: 'v1',
      startingBlocks: false,
    } as any,
    configPrivate: {
      adminApiSecret: 'test-secret',
    } as any,
  };

  // Helper function to create proper AxiosError mocks
  const createAxiosError = (status: number, message: string): Partial<AxiosError> => ({
    isAxiosError: true,
    message,
    name: 'AxiosError',
    config: {} as any,
    toJSON: () => ({}),
    response: {
      status,
      statusText: message,
      data: {},
      headers: {},
      config: {} as any,
    },
  });

  beforeEach(() => {
    service = new AdminApiServiceV1();
  });

  describe('getTenants', () => {
    it('should successfully return default tenant with ODS instances', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      // Mock successful API response with ODS instances
      const mockOdsInstancesResponse = [
        {
          id: 1,
          name: 'Production ODS',
          instanceType: 'Production',
          version: '5.3',
          isExtended: true,
          status: 'Active',
        },
        {
          id: 2,
          name: 'Test ODS',
          instanceType: 'Test',
          version: '5.3',
          isExtended: false,
          status: 'Active',
        },
      ];

      const mockGet = jest.fn().mockResolvedValue(mockOdsInstancesResponse);

      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getTenants(environment);

      expect(mockGet).toHaveBeenCalledWith('v1/odsInstances');
      expect(result).toHaveLength(1);
      
      // Verify default tenant structure
      expect(result[0]).toMatchObject({
        id: 'default',
        name: 'Test Environment',
      });
      
      // Verify ODS instances are mapped correctly
      expect(result[0].odsInstances).toHaveLength(2);
      expect(result[0].odsInstances![0]).toMatchObject({
        id: 1,
        name: 'Production ODS',
        instanceType: 'Production',
      });
      expect(result[0].odsInstances![1]).toMatchObject({
        id: 2,
        name: 'Test ODS',
        instanceType: 'Test',
      });
      
      // Verify edOrgs are empty
      expect(result[0].odsInstances![0].edOrgs).toEqual([]);
      expect(result[0].odsInstances![1].edOrgs).toEqual([]);
    });

    it('should map only id, name, and instanceType from ODS instances', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const mockOdsInstancesResponse = [
        {
          id: 1,
          name: 'ODS One',
          instanceType: 'Production',
          version: '6.0', // Should not be mapped
          isExtended: true, // Should not be mapped
          status: 'Active', // Should not be mapped
          extraField: 'value', // Should not be mapped
        },
      ];

      const mockGet = jest.fn().mockResolvedValue(mockOdsInstancesResponse);

      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getTenants(environment);

      const odsInstance = result[0].odsInstances![0];
      expect(odsInstance.id).toBe(1);
      expect(odsInstance.name).toBe('ODS One');
      expect(odsInstance.instanceType).toBe('Production');
      expect(odsInstance.edOrgs).toEqual([]);
      
      // Verify extra fields are not present
      expect(odsInstance).not.toHaveProperty('version');
      expect(odsInstance).not.toHaveProperty('isExtended');
      expect(odsInstance).not.toHaveProperty('status');
      expect(odsInstance).not.toHaveProperty('extraField');
    });

    it('should handle missing ODS instance ID by setting it to null', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const mockOdsInstancesResponse = [
        {
          name: 'ODS Without ID',
          instanceType: 'Test',
        },
      ];

      const mockGet = jest.fn().mockResolvedValue(mockOdsInstancesResponse);

      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getTenants(environment);

      expect(result[0].odsInstances![0].id).toBeNull();
      expect(result[0].odsInstances![0].name).toBe('ODS Without ID');
    });

    it('should use "Unknown" for missing ODS instance names', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const mockOdsInstancesResponse = [
        {
          id: 1,
          instanceType: 'Production',
          // name is missing
        },
      ];

      const mockGet = jest.fn().mockResolvedValue(mockOdsInstancesResponse);

      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getTenants(environment);

      expect(result[0].odsInstances![0].name).toBe('Unknown');
    });

    it('should return empty odsInstances array when API returns empty array', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const mockGet = jest.fn().mockResolvedValue([]);

      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getTenants(environment);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'default',
        name: 'Test Environment',
        odsInstances: [],
      });
    });

    it('should throw error when odsInstances endpoint returns non-array', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const mockGet = jest.fn().mockResolvedValue({ unexpected: 'object' });

      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: mockGet,
      });

      await expect(service.getTenants(environment)).rejects.toThrow();
    });

    it('should use "Default Tenant" when environment name is missing', async () => {
      const envWithoutName = { ...mockSbEnvironment, name: '' } as SbEnvironment;
      
      const mockGet = jest.fn().mockResolvedValue([]);

      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getTenants(envWithoutName);

      expect(result[0].name).toBe('Default Tenant');
    });

    it('should throw error for authentication failures', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const axiosError = createAxiosError(401, 'Unauthorized');
      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: jest.fn().mockRejectedValue(axiosError),
      });

      await expect(service.getTenants(environment)).rejects.toMatchObject({
        message: 'Unauthorized',
      });
    });

    it('should throw error for server errors', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const axiosError = createAxiosError(500, 'Internal Server Error');
      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: jest.fn().mockRejectedValue(axiosError),
      });

      await expect(service.getTenants(environment)).rejects.toMatchObject({
        message: 'Internal Server Error',
      });
    });

    it('should throw error for network failures', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const networkError = new Error('Network Error');
      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: jest.fn().mockRejectedValue(networkError),
      });

      await expect(service.getTenants(environment)).rejects.toMatchObject({
        message: 'Network Error',
      });
    });

    it('should return TenantDto array with correct structure', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const mockOdsInstancesResponse = [
        {
          id: 1,
          name: 'Test ODS',
          instanceType: 'Test',
        },
      ];

      const mockGet = jest.fn().mockResolvedValue(mockOdsInstancesResponse);

      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getTenants(environment);

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('odsInstances');
      expect(typeof result[0].id).toBe('string');
      expect(typeof result[0].name).toBe('string');
      expect(Array.isArray(result[0].odsInstances)).toBe(true);
      expect(result[0].odsInstances![0]).toHaveProperty('id');
      expect(result[0].odsInstances![0]).toHaveProperty('name');
      expect(result[0].odsInstances![0]).toHaveProperty('instanceType');
      expect(result[0].odsInstances![0]).toHaveProperty('edOrgs');
      expect(Array.isArray(result[0].odsInstances![0].edOrgs)).toBe(true);
    });

    it('should always return edOrgs as empty array for each ODS instance', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const mockOdsInstancesResponse = [
        { id: 1, name: 'ODS 1', instanceType: 'Type1' },
        { id: 2, name: 'ODS 2', instanceType: 'Type2' },
        { id: 3, name: 'ODS 3', instanceType: 'Type3' },
      ];

      const mockGet = jest.fn().mockResolvedValue(mockOdsInstancesResponse);

      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getTenants(environment);

      result[0].odsInstances!.forEach((odsInstance) => {
        expect(odsInstance.edOrgs).toEqual([]);
        expect(odsInstance.edOrgs).toHaveLength(0);
      });
    });
  });
});
