import 'reflect-metadata';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { AdminApiServiceV1 } from './admin-api.v1.service';

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

  beforeEach(() => {
    service = new AdminApiServiceV1();
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
            educationOrganizationId: 255901,
            nameOfInstitution: 'School One',
            shortNameOfInstitution: 'S1',
            discriminator: 'edfi.School',
            odsInstanceId: 1,
          },
        ],
        odsInstances: [
          {
            odsInstanceId: 1,
            name: 'ODS One',
            instanceType: 'Production',
            connectionString: 'Server=prod;Database=EdFi_Ods;',
            created: '2024-01-15T10:00:00Z',
          },
        ],
      };

      const mockDetailsResponseTwo = {
        edOrgs: [
          {
            educationOrganizationId: 255902,
            nameOfInstitution: 'School Two',
            discriminator: 'edfi.School',
            odsInstanceId: 2,
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
      expect(mockGet).toHaveBeenCalledWith('v1/tenants');
      expect(mockGet).toHaveBeenCalledWith('v1/tenant/tenant-one/details');
      expect(mockGet).toHaveBeenCalledWith('v1/tenant/tenant-two/details');

      // Verify first tenant
      expect(result[0]).toMatchObject({
        id: 'tenant-one',
        name: 'tenant-one',
      });
      expect(result[0].EdOrgs).toHaveLength(1);
      expect(result[0].EdOrgs![0]).toMatchObject({
        educationOrganizationId: 255901,
        nameOfInstitution: 'School One',
        shortNameOfInstitution: 'S1',
        discriminator: 'edfi.School',
        odsInstanceId: 1,
      });
      expect(result[0].OdsInstances).toHaveLength(1);
      expect(result[0].OdsInstances![0]).toMatchObject({
        id: 1,
        name: 'ODS One',
        instanceType: 'Production',
        connectionString: 'Server=prod;Database=EdFi_Ods;',
      });
      expect(result[0].OdsInstances![0].created).toBeInstanceOf(Date);

      // Verify second tenant
      expect(result[1]).toMatchObject({
        id: 'tenant-two',
        name: 'tenant-two',
      });
      expect(result[1].EdOrgs).toHaveLength(1);
      expect(result[1].OdsInstances).toHaveLength(1);
      expect(result[1].OdsInstances![0].id).toBe(2);
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
        EdOrgs: [],
        OdsInstances: [],
      });
    });

    it('should fallback to default tenant when endpoint returns 404', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const axiosError = {
        isAxiosError: true,
        response: { status: 404 },
        message: 'Not Found',
      };
      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: jest.fn().mockRejectedValue(axiosError),
      });

      const result = await service.getTenants(environment);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'default',
        name: 'Test Environment',
        EdOrgs: [],
        OdsInstances: [],
      });
    });

    it('should use "Default Tenant" when environment name is empty and endpoint returns 404', async () => {
      const envWithoutName = { ...mockSbEnvironment, name: '' } as SbEnvironment;
      
      const axiosError = {
        isAxiosError: true,
        response: { status: 404 },
        message: 'Not Found',
      };
      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: jest.fn().mockRejectedValue(axiosError),
      });

      const result = await service.getTenants(envWithoutName);

      expect(result[0].name).toBe('Default Tenant');
    });

    it('should throw error for non-404 errors (auth, network, server errors)', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      const axiosError = {
        isAxiosError: true,
        response: { status: 401 },
        message: 'Unauthorized',
      };
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
      expect(result[0]).toHaveProperty('EdOrgs');
      expect(result[0]).toHaveProperty('OdsInstances');
      expect(typeof result[0].id).toBe('string');
      expect(typeof result[0].name).toBe('string');
      expect(Array.isArray(result[0].EdOrgs)).toBe(true);
      expect(Array.isArray(result[0].OdsInstances)).toBe(true);
    });

    it('should handle ODS instances with missing IDs using array index', async () => {
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

      expect(result[0].OdsInstances![0].id).toBe(0);
      expect(result[0].OdsInstances![1].id).toBe(1);
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

      expect(result[0].OdsInstances![0].name).toBe('ODS Instance 1');
      expect(result[0].OdsInstances![1].name).toBe('ODS Instance 2');
      expect(result[0].OdsInstances![2].name).toBe('ODS Instance 3');
    });
  });
});

