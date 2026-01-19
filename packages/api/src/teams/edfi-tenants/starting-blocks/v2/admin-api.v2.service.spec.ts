import 'reflect-metadata';
import { SbEnvironment } from '@edanalytics/models-server';
import { AdminApiServiceV2 } from './admin-api.v2.service';
import { StartingBlocksServiceV2 } from './starting-blocks.v2.service';
import { AxiosError } from 'axios';

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('AdminApiServiceV2 - Extension Methods', () => {
  let service: AdminApiServiceV2;
  let mockStartingBlocksService: Partial<StartingBlocksServiceV2>;

  const mockSbEnvironment: Partial<SbEnvironment> = {
    id: 1,
    name: 'Test Environment',
    adminApiUrl: 'https://api.test.com',
    configPublic: {
      version: 'v2',
      values: {
        tenants: {
          'test-tenant': {
            adminApiKey: 'test-key',
          },
        },
      },
    } as any,
    configPrivate: {
      version: 'v2',
      tenants: {
        'test-tenant': {
          adminApiSecret: 'test-secret',
        },
      },
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
    mockStartingBlocksService = {
      saveAdminApiCredentials: jest.fn(),
    };
    service = new AdminApiServiceV2(mockStartingBlocksService as StartingBlocksServiceV2);
  });

  describe('getTenants', () => {
    it('should successfully return tenants with EdOrgs and OdsInstances from details endpoint', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      // Mock successful API response with tenant data
      const mockTenantsResponse = [
        { tenantName: 'tenant-one' },
        { tenantName: 'tenant-two' },
      ];

      const mockDetailsResponseOne = {
        edOrgs: [
          {
            instanceId: 1,
            instanceName: 'ODS One',
            educationOrganizationId: 255901,
            nameOfInstitution: 'School One',
            shortNameOfInstitution: 'S1',
            discriminator: 'edfi.School',
            parentId: 255900,
          },
        ],
        odsInstances: [
          {
            odsInstanceId: 1,
            name: 'ODS One',
            instanceType: 'Production',
          },
        ],
      };

      const mockDetailsResponseTwo = {
        edOrgs: [
          {
            instanceId: 2,
            instanceName: 'ODS Two',
            educationOrganizationId: 255902,
            nameOfInstitution: 'School Two',
            discriminator: 'edfi.School',
          },
        ],
        odsInstances: [
          {
            id: 2,
            name: 'ODS Two',
            instanceType: 'Test',
          },
        ],
      };

      const mockGet = jest.fn()
        .mockResolvedValueOnce(mockTenantsResponse)
        .mockResolvedValueOnce(mockDetailsResponseOne)
        .mockResolvedValueOnce(mockDetailsResponseTwo);

      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getTenants(environment);

      expect(result).toHaveLength(2);
      expect(mockGet).toHaveBeenCalledWith('tenants');
      expect(mockGet).toHaveBeenCalledWith('tenant/tenant-one/details');
      expect(mockGet).toHaveBeenCalledWith('tenant/tenant-two/details');

      // Verify first tenant
      expect(result[0]).toMatchObject({
        id: 'tenant-one',
        name: 'tenant-one',
      });
      expect(result[0].edOrgs).toHaveLength(1);
      expect(result[0].edOrgs![0]).toMatchObject({
        instanceId: 1,
        instanceName: 'ODS One',
        educationOrganizationId: 255901,
        nameOfInstitution: 'School One',
        shortNameOfInstitution: 'S1',
        discriminator: 'edfi.School',
        parentId: 255900,
      });
      expect(result[0].odsInstances).toHaveLength(1);
      expect(result[0].odsInstances![0]).toMatchObject({
        id: 1,
        name: 'ODS One',
        instanceType: 'Production',
      });

      // Verify second tenant
      expect(result[1]).toMatchObject({
        id: 'tenant-two',
        name: 'tenant-two',
      });
      expect(result[1].edOrgs).toHaveLength(1);
      expect(result[1].edOrgs![0]).toMatchObject({
        instanceId: 2,
        instanceName: 'ODS Two',
        educationOrganizationId: 255902,
        nameOfInstitution: 'School Two',
        discriminator: 'edfi.School',
      });
      expect(result[1].odsInstances).toHaveLength(1);
      expect(result[1].odsInstances![0].id).toBe(2);
    });

    it('should handle tenant details endpoint failure gracefully', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const mockTenantsResponse = [{ tenantName: 'tenant-one' }];

      const mockGet = jest.fn()
        .mockResolvedValueOnce(mockTenantsResponse)
        .mockRejectedValueOnce(new Error('Details endpoint error'));

      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getTenants(environment);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'tenant-one',
        name: 'tenant-one',
        edOrgs: [],
        odsInstances: [],
      });
    });

    it('should fallback to default tenant when endpoint returns 404', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const axiosError = createAxiosError(404, 'Not Found');
      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: jest.fn().mockRejectedValue(axiosError),
      });

      const result = await service.getTenants(environment);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'default',
        name: 'Test Environment',
        edOrgs: [],
        odsInstances: [],
      });
    });

    it('should use "Default Tenant" when environment name is empty and endpoint returns 404', async () => {
      const envWithoutName = { ...mockSbEnvironment, name: '' } as SbEnvironment;
      
      const axiosError = createAxiosError(404, 'Not Found');
      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: jest.fn().mockRejectedValue(axiosError),
      });

      const result = await service.getTenants(envWithoutName);

      expect(result[0].name).toBe('Default Tenant');
    });

    it('should throw error for non-404 errors (auth, network, server errors)', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const axiosError = createAxiosError(401, 'Unauthorized');
      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: jest.fn().mockRejectedValue(axiosError),
      });

      await expect(service.getTenants(environment)).rejects.toMatchObject({
        message: 'Unauthorized',
      });
    });

    it('should return TenantDto array with correct structure', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const mockTenantsResponse = [{ tenantName: 'tenant-one' }];
      const mockDetailsResponse = {
        edOrgs: [],
        odsInstances: [],
      };

      const mockGet = jest.fn()
        .mockResolvedValueOnce(mockTenantsResponse)
        .mockResolvedValueOnce(mockDetailsResponse);

      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getTenants(environment);

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('edOrgs');
      expect(result[0]).toHaveProperty('odsInstances');
      expect(typeof result[0].id).toBe('string');
      expect(typeof result[0].name).toBe('string');
      expect(Array.isArray(result[0].edOrgs)).toBe(true);
      expect(Array.isArray(result[0].odsInstances)).toBe(true);
    });

    it('should set ODS instance ID to null when odsInstanceId and id are missing', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const mockTenantsResponse = [{ tenantName: 'tenant-one' }];
      const mockDetailsResponse = {
        edOrgs: [],
        odsInstances: [
          { name: 'ODS 1', instanceType: 'Type1' },
          { name: 'ODS 2', instanceType: 'Type2' },
        ],
      };

      const mockGet = jest.fn()
        .mockResolvedValueOnce(mockTenantsResponse)
        .mockResolvedValueOnce(mockDetailsResponse);

      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getTenants(environment);

      expect(result[0].odsInstances![0].id).toBeNull();
      expect(result[0].odsInstances![1].id).toBeNull();
    });

    it('should generate default names for ODS instances with missing names', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const mockTenantsResponse = [{ tenantName: 'tenant-one' }];
      const mockDetailsResponse = {
        edOrgs: [],
        odsInstances: [{}, {}, {}],
      };

      const mockGet = jest.fn()
        .mockResolvedValueOnce(mockTenantsResponse)
        .mockResolvedValueOnce(mockDetailsResponse);

      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getTenants(environment);

      expect(result[0].odsInstances![0].name).toBe('ODS Instance 1');
      expect(result[0].odsInstances![1].name).toBe('ODS Instance 2');
      expect(result[0].odsInstances![2].name).toBe('ODS Instance 3');
    });

    it('should handle non-array response from tenants endpoint by returning default tenant', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      // Mock API returning non-array response
      const mockGet = jest.fn().mockResolvedValue({ unexpected: 'object' });

      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getTenants(environment);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'default',
        name: 'Test Environment',
        edOrgs: [],
        odsInstances: [],
      });
    });

    it('should filter out invalid tenant objects and return valid tenants', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const mockTenantsResponse = [
        { tenantName: 'valid-tenant' },
        null, // Invalid: null
        { invalidProperty: 'no-tenantName' }, // Invalid: missing tenantName
        { tenantName: 123 }, // Invalid: tenantName is not a string
        { tenantName: 'another-valid-tenant' },
      ];

      const mockDetailsResponse = {
        edOrgs: [],
        odsInstances: [],
      };

      const mockGet = jest.fn()
        .mockResolvedValueOnce(mockTenantsResponse)
        .mockResolvedValueOnce(mockDetailsResponse)
        .mockResolvedValueOnce(mockDetailsResponse);

      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getTenants(environment);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('valid-tenant');
      expect(result[1].id).toBe('another-valid-tenant');
    });

    it('should return default tenant when all tenant objects are invalid', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const mockTenantsResponse = [
        null,
        { invalidProperty: 'no-tenantName' },
        { tenantName: 123 },
      ];

      const mockGet = jest.fn().mockResolvedValue(mockTenantsResponse);

      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getTenants(environment);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'default',
        name: 'Test Environment',
        edOrgs: [],
        odsInstances: [],
      });
    });
  });
});
