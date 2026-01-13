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

  const mockEdfiTenant: Partial<EdfiTenant> = {
    id: 1,
    name: 'Test Tenant',
    sbEnvironmentId: 1,
    sbEnvironment: mockSbEnvironment as SbEnvironment,
  };

  beforeEach(() => {
    service = new AdminApiServiceV1();
  });

  describe('getTenants', () => {
    it('should fallback to default tenant and return single tenant with environment name', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      // Mock the getAdminApiClientUsingEnv to throw error (simulating API unavailable)
      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('API Error')),
      });

      const result = await service.getTenants(environment);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'default',
        name: 'Test Environment',
      });
    });

    it('should use "Default Tenant" when environment name is empty', async () => {
      const envWithoutName = { ...mockSbEnvironment, name: '' } as SbEnvironment;
      
      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('API Error')),
      });

      const result = await service.getTenants(envWithoutName);

      expect(result[0].name).toBe('Default Tenant');
    });

    it('should return TenantDto array with correct structure', async () => {
      const environment = mockSbEnvironment as SbEnvironment;
      
      jest.spyOn(service as any, 'getAdminApiClientUsingEnv').mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('API Error')),
      });

      const result = await service.getTenants(environment);

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(typeof result[0].id).toBe('string');
      expect(typeof result[0].name).toBe('string');
    });
  });

  describe('getEducationOrganizations', () => {
    const mockEdOrgs = [
      {
        educationOrganizationId: 255901,
        nameOfInstitution: 'Grand Bend ISD',
        shortNameOfInstitution: 'GBISD',
        discriminator: 'edfi.LocalEducationAgency',
        odsInstanceId: 1,
      },
      {
        educationOrganizationId: 255901001,
        nameOfInstitution: 'Grand Bend Elementary School',
        shortNameOfInstitution: 'GBES',
        discriminator: 'edfi.School',
        odsInstanceId: 1,
      },
      {
        educationOrganizationId: 255901002,
        nameOfInstitution: 'Grand Bend High School',
        discriminator: 'edfi.School',
      },
    ];

    it('should transform API response to EducationOrganizationDto format', async () => {
      const tenant = mockEdfiTenant as EdfiTenant;
      const mockGet = jest.fn().mockResolvedValue(mockEdOrgs);

      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getEducationOrganizations(tenant);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        educationOrganizationId: 255901,
        nameOfInstitution: 'Grand Bend ISD',
        shortNameOfInstitution: 'GBISD',
        discriminator: 'edfi.LocalEducationAgency',
      });
    });

    it('should call endpoint without instanceId when not provided', async () => {
      const tenant = mockEdfiTenant as EdfiTenant;
      const mockGet = jest.fn().mockResolvedValue(mockEdOrgs);

      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({
        get: mockGet,
      });

      await service.getEducationOrganizations(tenant);

      expect(mockGet).toHaveBeenCalledWith('v1/educationOrganizations');
    });

    it('should call endpoint with instanceId when provided', async () => {
      const tenant = mockEdfiTenant as EdfiTenant;
      const mockGet = jest.fn().mockResolvedValue(mockEdOrgs);

      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({
        get: mockGet,
      });

      await service.getEducationOrganizations(tenant, 5);

      expect(mockGet).toHaveBeenCalledWith('v1/educationOrganizations/5');
    });

    it('should use provided instanceId for edOrgs without odsInstanceId', async () => {
      const tenant = mockEdfiTenant as EdfiTenant;
      const mockGet = jest.fn().mockResolvedValue(mockEdOrgs);

      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getEducationOrganizations(tenant, 10);

      // Third edOrg doesn't have odsInstanceId, should use provided instanceId
      expect(result[2].odsInstanceId).toBe(10);
      // First two edOrgs have odsInstanceId, should keep them
      expect(result[0].odsInstanceId).toBe(1);
      expect(result[1].odsInstanceId).toBe(1);
    });

    it('should return EducationOrganizationDto array with correct structure', async () => {
      const tenant = mockEdfiTenant as EdfiTenant;
      const mockGet = jest.fn().mockResolvedValue(mockEdOrgs);

      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getEducationOrganizations(tenant);

      result.forEach((edOrg) => {
        expect(edOrg).toHaveProperty('educationOrganizationId');
        expect(edOrg).toHaveProperty('nameOfInstitution');
        expect(edOrg).toHaveProperty('discriminator');
        expect(typeof edOrg.educationOrganizationId).toBe('number');
        expect(typeof edOrg.nameOfInstitution).toBe('string');
        expect(typeof edOrg.discriminator).toBe('string');
      });
    });
  });

  describe('getOdsInstancesForDefaultTenant', () => {
    const mockOdsInstances = [
      {
        odsInstanceId: 1,
        name: 'Production ODS',
        instanceType: 'Production',
        connectionString: 'Server=prod;Database=EdFi_Ods_Production;',
        created: '2024-01-15T10:00:00Z',
      },
      {
        id: 2,
        name: 'Test ODS',
        instanceType: 'Test',
        connectionString: 'Server=test;Database=EdFi_Ods_Test;',
        created: '2024-02-20T14:30:00Z',
      },
      {
        name: 'Sandbox ODS',
        instanceType: 'Sandbox',
      },
    ];

    it('should transform API response to OdsInstanceDto format', async () => {
      const tenant = mockEdfiTenant as EdfiTenant;
      const mockGet = jest.fn().mockResolvedValue(mockOdsInstances);

      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getOdsInstancesForDefaultTenant(tenant);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        id: 1,
        name: 'Production ODS',
        instanceType: 'Production',
        connectionString: 'Server=prod;Database=EdFi_Ods_Production;',
      });
      expect(result[0].created).toBeInstanceOf(Date);
    });

    it('should call correct endpoint', async () => {
      const tenant = mockEdfiTenant as EdfiTenant;
      const mockGet = jest.fn().mockResolvedValue(mockOdsInstances);

      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({
        get: mockGet,
      });

      await service.getOdsInstancesForDefaultTenant(tenant);

      expect(mockGet).toHaveBeenCalledWith('v1/odsInstances');
    });

    it('should use array index for missing IDs', async () => {
      const tenant = mockEdfiTenant as EdfiTenant;
      const instancesWithoutIds = [
        { name: 'ODS 1', instanceType: 'Type1' },
        { name: 'ODS 2', instanceType: 'Type2' },
      ];

      const mockGet = jest.fn().mockResolvedValue(instancesWithoutIds);

      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getOdsInstancesForDefaultTenant(tenant);

      expect(result[0].id).toBe(0);
      expect(result[1].id).toBe(1);
      expect(result[0].name).toBe('ODS 1');
      expect(result[1].name).toBe('ODS 2');
    });

    it('should prefer odsInstanceId over id field', async () => {
      const tenant = mockEdfiTenant as EdfiTenant;
      const mockGet = jest.fn().mockResolvedValue(mockOdsInstances);

      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getOdsInstancesForDefaultTenant(tenant);

      // First instance has odsInstanceId
      expect(result[0].id).toBe(1);
      // Second instance has id but not odsInstanceId
      expect(result[1].id).toBe(2);
      // Third has neither, uses index
      expect(result[2].id).toBe(2);
    });

    it('should generate default names for missing names', async () => {
      const tenant = mockEdfiTenant as EdfiTenant;
      const instancesWithoutNames = [{}, {}, {}];

      const mockGet = jest.fn().mockResolvedValue(instancesWithoutNames);

      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getOdsInstancesForDefaultTenant(tenant);

      expect(result[0].name).toBe('ODS Instance 1');
      expect(result[1].name).toBe('ODS Instance 2');
      expect(result[2].name).toBe('ODS Instance 3');
    });

    it('should convert created date strings to Date objects', async () => {
      const tenant = mockEdfiTenant as EdfiTenant;
      const mockGet = jest.fn().mockResolvedValue(mockOdsInstances);

      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getOdsInstancesForDefaultTenant(tenant);

      expect(result[0].created).toBeInstanceOf(Date);
      expect(result[1].created).toBeInstanceOf(Date);
      // Third instance has no created date, should get default
      expect(result[2].created).toBeInstanceOf(Date);
    });

    it('should return OdsInstanceDto array with correct structure', async () => {
      const tenant = mockEdfiTenant as EdfiTenant;
      const mockGet = jest.fn().mockResolvedValue(mockOdsInstances);

      jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({
        get: mockGet,
      });

      const result = await service.getOdsInstancesForDefaultTenant(tenant);

      result.forEach((instance) => {
        expect(instance).toHaveProperty('id');
        expect(instance).toHaveProperty('name');
        expect(instance).toHaveProperty('created');
        expect(typeof instance.name).toBe('string');
        expect(instance.created).toBeInstanceOf(Date);
      });
    });
  });
});
