/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { TenantDto } from '@edanalytics/models';
import { AdminApiSyncService } from './adminapi-sync.service';
import { AdminApiServiceV1, AdminApiServiceV2 } from '../../teams/edfi-tenants/starting-blocks';
import * as adminApiDataAdapterUtils from '../../utils/admin-api-data-adapter-utils';
import * as syncOds from '../sync-ods';

describe('AdminApiSyncService', () => {
  let service: AdminApiSyncService;
  let adminApiServiceV1: jest.Mocked<AdminApiServiceV1>;
  let adminApiServiceV2: jest.Mocked<AdminApiServiceV2>;
  let edfiTenantsRepository: jest.Mocked<Repository<EdfiTenant>>;
  let entityManager: jest.Mocked<EntityManager>;

  const mockSbEnvironmentV1: Partial<SbEnvironment> = {
    id: 1,
    name: 'Test Environment V1',
    adminApiUrl: 'https://api.test.com',
    version: 'v1',
    configPublic: {
      version: 'v1',
      values: {
        edfiHostname: 'test.edfi.org',
        adminApiUrl: 'https://api.test.com',
        adminApiKey: 'test-key',
      },
      adminApiUrl: 'https://api.test.com',
      startingBlocks: false,
    } as any,
    configPrivate: {
      adminApiSecret: 'test-secret',
    } as any,
  };

  const mockSbEnvironmentV2: Partial<SbEnvironment> = {
    id: 2,
    name: 'Test Environment V2',
    adminApiUrl: 'https://api.test.com',
    version: 'v2',
    configPublic: {
      version: 'v2',
      values: {
        edfiHostname: 'test.edfi.org',
        tenants: {
          'tenant-one': {
            adminApiKey: 'key1',
          },
          'tenant-two': {
            adminApiKey: 'key2',
          },
        },
      },
      adminApiUrl: 'https://api.test.com',
      startingBlocks: false,
    } as any,
    configPrivate: {
      tenants: {
        'tenant-one': {
          adminApiSecret: 'secret1',
        },
        'tenant-two': {
          adminApiSecret: 'secret2',
        },
      },
    } as any,
  };

  const mockTenantDto: TenantDto = {
    id: 'tenant-1',
    name: 'tenant-one',
    odsInstances: [
      {
        id: 1,
        name: 'ODS One',
        instanceType: 'Production',
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
      },
    ],
  };

  const mockEdfiTenant: Partial<EdfiTenant> = {
    id: 1,
    name: 'tenant-one',
    sbEnvironmentId: 1,
    created: new Date(),
    odss: [],
  };

  beforeEach(async () => {
    const mockEdfiTenantsRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const mockEntityManager = {
      transaction: jest.fn(),
      getRepository: jest.fn(),
    };

    const mockSbEnvironmentsRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const mockAdminApiServiceV1 = {
      getTenants: jest.fn(),
    };

    const mockAdminApiServiceV2 = {
      getTenants: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminApiSyncService,
        {
          provide: AdminApiServiceV1,
          useValue: mockAdminApiServiceV1,
        },
        {
          provide: AdminApiServiceV2,
          useValue: mockAdminApiServiceV2,
        },
        {
          provide: getRepositoryToken(EdfiTenant),
          useValue: mockEdfiTenantsRepository,
        },
        {
          provide: getRepositoryToken(SbEnvironment),
          useValue: mockSbEnvironmentsRepository,
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
      ],
    }).compile();

    service = module.get<AdminApiSyncService>(AdminApiSyncService);
    adminApiServiceV1 = module.get(AdminApiServiceV1) as jest.Mocked<AdminApiServiceV1>;
    adminApiServiceV2 = module.get(AdminApiServiceV2) as jest.Mocked<AdminApiServiceV2>;
    edfiTenantsRepository = module.get(getRepositoryToken(EdfiTenant)) as jest.Mocked<
      Repository<EdfiTenant>
    >;
    entityManager = module.get(EntityManager) as jest.Mocked<EntityManager>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('syncEnvironmentData', () => {
    describe('validation', () => {
      it('should return NO_ADMIN_API_CONFIG when adminApiUrl is missing', async () => {
        const envWithoutUrl = { ...mockSbEnvironmentV1, adminApiUrl: undefined };

        const result = await service.syncEnvironmentData(envWithoutUrl as SbEnvironment);

        expect(result.status).toBe('NO_ADMIN_API_CONFIG');
        expect(result.message).toContain('Admin API URL is not configured');
      });

      it('should return INVALID_VERSION when version is missing', async () => {
        const envWithoutVersion = { ...mockSbEnvironmentV1, version: undefined };

        const result = await service.syncEnvironmentData(envWithoutVersion as SbEnvironment);

        expect(result.status).toBe('INVALID_VERSION');
        expect(result.message).toContain('Invalid API version');
      });

      it('should return INVALID_VERSION when version is not v1 or v2', async () => {
        const envWithInvalidVersion = { ...mockSbEnvironmentV1, version: 'v3' as any };

        const result = await service.syncEnvironmentData(envWithInvalidVersion as SbEnvironment);

        expect(result.status).toBe('INVALID_VERSION');
        expect(result.message).toContain('Invalid API version: v3');
      });
    });

    describe('v1 environment sync', () => {
      it('should successfully sync v1 environment with one tenant', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        const tenants = [mockTenantDto];

        adminApiServiceV1.getTenants.mockResolvedValue(tenants);
        edfiTenantsRepository.findOne.mockResolvedValue(null);
        edfiTenantsRepository.save.mockResolvedValue(mockEdfiTenant as EdfiTenant);

        jest.spyOn(adminApiDataAdapterUtils, 'transformTenantData').mockReturnValue({
          name: 'tenant-one',
          sbEnvironmentId: 1,
          odss: [
            {
              odsInstanceId: 1,
              odsInstanceName: 'ODS One',
              edorgs: [
                {
                  educationOrganizationId: 255901,
                  nameOfInstitution: 'School One',
                  shortNameOfInstitution: 'S1',
                  discriminator: 'edfi.School' as any,
                  parentId: 255900,
                },
              ],
            },
          ],
        } as any);

        const persistSyncTenantSpy = jest
          .spyOn(syncOds, 'persistSyncTenant')
          .mockResolvedValue(undefined);

        entityManager.transaction.mockImplementation(async (callback: any) => {
          return callback(entityManager);
        });

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(result.tenantsProcessed).toBe(1);
        expect(adminApiServiceV1.getTenants).toHaveBeenCalledWith(environment);
        expect(edfiTenantsRepository.save).toHaveBeenCalled();
        expect(persistSyncTenantSpy).toHaveBeenCalled();
      });

      it('should use existing tenant if found', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        const tenants = [mockTenantDto];

        adminApiServiceV1.getTenants.mockResolvedValue(tenants);
        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenant as EdfiTenant);

        jest.spyOn(adminApiDataAdapterUtils, 'transformTenantData').mockReturnValue({
          name: 'tenant-one',
          sbEnvironmentId: 1,
          odss: [
            {
              odsInstanceId: 1,
              odsInstanceName: 'ODS One',
              edorgs: [],
            },
          ],
        } as any);

        jest.spyOn(syncOds, 'persistSyncTenant').mockResolvedValue(undefined);

        entityManager.transaction.mockImplementation(async (callback: any) => {
          return callback(entityManager);
        });

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(edfiTenantsRepository.findOne).toHaveBeenCalledWith({
          where: {
            name: 'tenant-one',
            sbEnvironmentId: 1,
          },
          relations: ['odss', 'odss.edorgs'],
        });
        expect(edfiTenantsRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('v2 environment sync', () => {
      it('should successfully sync v2 environment with multiple tenants', async () => {
        const environment = mockSbEnvironmentV2 as SbEnvironment;
        const tenants = [
          mockTenantDto,
          { ...mockTenantDto, id: 'tenant-2', name: 'tenant-two' },
        ];

        adminApiServiceV2.getTenants.mockResolvedValue(tenants);
        edfiTenantsRepository.findOne.mockResolvedValue(null);
        edfiTenantsRepository.save.mockResolvedValue(mockEdfiTenant as EdfiTenant);

        jest.spyOn(adminApiDataAdapterUtils, 'transformTenantData').mockReturnValue({
          name: 'tenant-one',
          sbEnvironmentId: 2,
          odss: [],
        } as any);

        jest.spyOn(syncOds, 'persistSyncTenant').mockResolvedValue(undefined);

        entityManager.transaction.mockImplementation(async (callback: any) => {
          return callback(entityManager);
        });

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(result.tenantsProcessed).toBe(2);
        expect(adminApiServiceV2.getTenants).toHaveBeenCalledWith(environment);
      });

      it('should use v2 service for v2 environment', async () => {
        const environment = mockSbEnvironmentV2 as SbEnvironment;
        adminApiServiceV2.getTenants.mockResolvedValue([]);

        await service.syncEnvironmentData(environment);

        expect(adminApiServiceV2.getTenants).toHaveBeenCalledWith(environment);
        expect(adminApiServiceV1.getTenants).not.toHaveBeenCalled();
      });
    });

    describe('tenant discovery', () => {
      it('should return success with 0 tenants when no tenants found', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        adminApiServiceV1.getTenants.mockResolvedValue([]);

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(result.message).toContain('No tenants found to sync');
        expect(result.tenantsProcessed).toBe(0);
      });

      it('should return success with 0 tenants when getTenants returns null', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        adminApiServiceV1.getTenants.mockResolvedValue(null as any);

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(result.tenantsProcessed).toBe(0);
      });
    });

    describe('ODS and EdOrg processing', () => {
      it('should skip ODS sync when tenant has no ODS instances', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        const tenantWithoutOds = { ...mockTenantDto, odsInstances: [] };

        adminApiServiceV1.getTenants.mockResolvedValue([tenantWithoutOds]);
        edfiTenantsRepository.findOne.mockResolvedValue(null);
        edfiTenantsRepository.save.mockResolvedValue(mockEdfiTenant as EdfiTenant);

        jest.spyOn(adminApiDataAdapterUtils, 'transformTenantData').mockReturnValue({
          name: 'tenant-one',
          sbEnvironmentId: 1,
          odss: [],
        } as any);

        const persistSyncTenantSpy = jest.spyOn(syncOds, 'persistSyncTenant');

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(persistSyncTenantSpy).not.toHaveBeenCalled();
      });

      it('should sync ODS instances with education organizations', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        adminApiServiceV1.getTenants.mockResolvedValue([mockTenantDto]);
        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenant as EdfiTenant);

        jest.spyOn(adminApiDataAdapterUtils, 'transformTenantData').mockReturnValue({
          name: 'tenant-one',
          sbEnvironmentId: 1,
          odss: [
            {
              odsInstanceId: 1,
              odsInstanceName: 'ODS One',
              edorgs: [
                {
                  educationOrganizationId: 255901,
                  nameOfInstitution: 'School One',
                  shortNameOfInstitution: 'S1',
                  discriminator: 'edfi.School' as any,
                  parentId: 255900,
                },
              ],
            },
          ],
        } as any);

        const persistSyncTenantSpy = jest
          .spyOn(syncOds, 'persistSyncTenant')
          .mockResolvedValue(undefined);

        entityManager.transaction.mockImplementation(async (callback: any) => {
          return callback(entityManager);
        });

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(persistSyncTenantSpy).toHaveBeenCalledWith({
          em: entityManager,
          edfiTenant: mockEdfiTenant,
          odss: expect.arrayContaining([
            expect.objectContaining({
              id: 1,
              name: 'ODS One',
              dbName: 'ODS One',
              edorgs: expect.arrayContaining([
                expect.objectContaining({
                  educationorganizationid: 255901,
                  nameofinstitution: 'School One',
                  shortnameofinstitution: 'S1',
                  discriminator: 'edfi.School',
                  parent: 255900,
                }),
              ]),
            }),
          ]),
        });
      });
    });

    describe('error handling', () => {
      it('should continue processing other tenants if one fails', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        const tenants = [
          mockTenantDto,
          { ...mockTenantDto, id: 'tenant-2', name: 'tenant-two' },
        ];

        adminApiServiceV1.getTenants.mockResolvedValue(tenants);
        edfiTenantsRepository.findOne
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(mockEdfiTenant as EdfiTenant);
        edfiTenantsRepository.save.mockRejectedValueOnce(new Error('Database error'));

        jest.spyOn(adminApiDataAdapterUtils, 'transformTenantData').mockReturnValue({
          name: 'tenant-one',
          sbEnvironmentId: 1,
          odss: [],
        } as any);

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(result.tenantsProcessed).toBe(1);
        expect(result.message).toContain('1 of 2');
      });

      it('should return ERROR status when getTenants fails', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        const error = new Error('Admin API connection failed');
        adminApiServiceV1.getTenants.mockRejectedValue(error);

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('ERROR');
        expect(result.message).toBe('Admin API connection failed');
        expect(result.error).toBe(error);
      });

      it('should handle transformTenantData errors', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        adminApiServiceV1.getTenants.mockResolvedValue([mockTenantDto]);
        edfiTenantsRepository.findOne.mockResolvedValue(null);

        jest
          .spyOn(adminApiDataAdapterUtils, 'transformTenantData')
          .mockImplementation(() => {
            throw new Error('Transform error');
          });

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(result.tenantsProcessed).toBe(0);
      });

      it('should handle persistSyncTenant errors', async () => {
        const environment = mockSbEnvironmentV1 as SbEnvironment;
        adminApiServiceV1.getTenants.mockResolvedValue([mockTenantDto]);
        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenant as EdfiTenant);

        jest.spyOn(adminApiDataAdapterUtils, 'transformTenantData').mockReturnValue({
          name: 'tenant-one',
          sbEnvironmentId: 1,
          odss: [
            {
              odsInstanceId: 1,
              odsInstanceName: 'ODS One',
              edorgs: [],
            },
          ],
        } as any);

        jest.spyOn(syncOds, 'persistSyncTenant').mockRejectedValue(new Error('Sync error'));

        entityManager.transaction.mockImplementation(async (callback: any) => {
          return callback(entityManager);
        });

        const result = await service.syncEnvironmentData(environment);

        expect(result.status).toBe('SUCCESS');
        expect(result.tenantsProcessed).toBe(0);
      });
    });
  });

  describe('syncTenantData', () => {
    const mockEdfiTenantWithEnvironment: Partial<EdfiTenant> & { sbEnvironment: SbEnvironment } = {
      id: 1,
      name: 'tenant-one',
      sbEnvironmentId: 1,
      created: new Date(),
      odss: [],
      sbEnvironment: mockSbEnvironmentV1 as SbEnvironment,
    };

    const mockEdfiTenantV2WithEnvironment: Partial<EdfiTenant> & { sbEnvironment: SbEnvironment } = {
      id: 2,
      name: 'tenant-two',
      sbEnvironmentId: 2,
      created: new Date(),
      odss: [],
      sbEnvironment: mockSbEnvironmentV2 as SbEnvironment,
    };

    const mockTenantDetails = {
      odsInstances: [
        {
          odsInstanceId: 1,
          id: 1,
          name: 'ODS One',
          instanceType: 'Production',
          edOrgs: [
            {
              educationOrganizationId: 255901,
              nameOfInstitution: 'School One',
              shortNameOfInstitution: 'S1',
              discriminator: 'edfi.School',
              parentId: 255900,
            },
          ],
        },
      ],
    };

    beforeEach(() => {
      // Reset mocks for each test
      jest.clearAllMocks();
      jest.restoreAllMocks();
    });

    describe('validation', () => {
      it('should return ERROR when tenant not found', async () => {
        edfiTenantsRepository.findOne.mockResolvedValue(null);

        const result = await (service as any).syncTenantData(mockEdfiTenant as EdfiTenant);

        expect(result.status).toBe('ERROR');
        expect(result.message).toContain('Tenant not found or missing environment');
      });

      it('should return ERROR when tenant has no environment', async () => {
        const tenantWithoutEnv = { ...mockEdfiTenant, sbEnvironment: null };
        edfiTenantsRepository.findOne.mockResolvedValue(tenantWithoutEnv as any);

        const result = await (service as any).syncTenantData(mockEdfiTenant as EdfiTenant);

        expect(result.status).toBe('ERROR');
        expect(result.message).toContain('Tenant not found or missing environment');
      });

      it('should return NO_ADMIN_API_CONFIG when environment has no Admin API URL', async () => {
        const tenantWithInvalidEnv = {
          ...mockEdfiTenantWithEnvironment,
          sbEnvironment: { ...mockSbEnvironmentV1, adminApiUrl: undefined },
        };
        edfiTenantsRepository.findOne.mockResolvedValue(tenantWithInvalidEnv as any);

        const result = await (service as any).syncTenantData(mockEdfiTenant as EdfiTenant);

        expect(result.status).toBe('NO_ADMIN_API_CONFIG');
        expect(result.message).toContain('Admin API URL is not configured');
      });

      it('should return INVALID_VERSION when environment has invalid version', async () => {
        const tenantWithInvalidVersion = {
          ...mockEdfiTenantWithEnvironment,
          sbEnvironment: { ...mockSbEnvironmentV1, version: 'v3' as any },
        };
        edfiTenantsRepository.findOne.mockResolvedValue(tenantWithInvalidVersion as any);

        const result = await (service as any).syncTenantData(mockEdfiTenant as EdfiTenant);

        expect(result.status).toBe('INVALID_VERSION');
        expect(result.message).toContain('Invalid API version');
      });
    });

    describe('v1 tenant sync', () => {
      it('should return ERROR for v1 environments (single-tenant only)', async () => {
        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenantWithEnvironment as EdfiTenant);

        const result = await (service as any).syncTenantData(mockEdfiTenant as EdfiTenant);

        expect(result.status).toBe('ERROR');
        expect(result.message).toContain('V1 Admin API is single-tenant');
        expect(result.message).toContain('Use syncEnvironmentData');
      });
    });

    describe('v2 tenant sync', () => {
      const mockEdfiTenantV2WithEnvironment: Partial<EdfiTenant> & { sbEnvironment: SbEnvironment } = {
        id: 2,
        name: 'tenant-two',
        sbEnvironmentId: 2,
        created: new Date(),
        odss: [],
        sbEnvironment: mockSbEnvironmentV2 as SbEnvironment,
      };

      it('should successfully sync v2 tenant with multiple ODS instances', async () => {
        const tenantDetailsV2 = {
          odsInstances: [
            {
              id: 1,
              name: 'ODS One',
              instanceType: 'Production',
              educationOrganizations: [
                {
                  educationOrganizationId: 255901,
                  nameOfInstitution: 'School One',
                  discriminator: 'edfi.School',
                },
              ],
            },
            {
              id: 2,
              name: 'ODS Two',
              instanceType: 'Production',
              educationOrganizations: [
                {
                  educationOrganizationId: 255902,
                  nameOfInstitution: 'School Two',
                  discriminator: 'edfi.LocalEducationAgency',
                },
              ],
            },
          ],
        };

        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenantV2WithEnvironment as EdfiTenant);

        const mockApiClient = {
          get: jest.fn().mockResolvedValue(tenantDetailsV2),
        };

        (adminApiServiceV2 as any)['getAdminApiClient'] = jest.fn().mockReturnValue(mockApiClient);

        const persistSyncTenantSpy = jest
          .spyOn(syncOds, 'persistSyncTenant')
          .mockResolvedValue(undefined);

        entityManager.transaction.mockImplementation(async (callback: any) => {
          return callback(entityManager);
        });

        const result = await (service as any).syncTenantData({ id: 2, name: 'tenant-two' } as EdfiTenant);

        expect(result.status).toBe('SUCCESS');
        expect(result.message).toContain('Successfully synced 2 ODS instance');
        expect(mockApiClient.get).toHaveBeenCalledWith('tenants/tenant-two/OdsInstances/edOrgs');
        expect(persistSyncTenantSpy).toHaveBeenCalled();
      });

      it('should use correct v2 endpoint format', async () => {
        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenantV2WithEnvironment as EdfiTenant);

        const mockApiClient = {
          get: jest.fn().mockResolvedValue({ odsInstances: [] }),
        };

        (adminApiServiceV2 as any)['getAdminApiClient'] = jest.fn().mockReturnValue(mockApiClient);

        await (service as any).syncTenantData({ id: 2, name: 'tenant-two' } as EdfiTenant);

        expect(mockApiClient.get).toHaveBeenCalledWith('tenants/tenant-two/OdsInstances/edOrgs');
      });
    });

    describe('error handling', () => {
      it('should return ERROR when Admin API call fails', async () => {
        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenantV2WithEnvironment as EdfiTenant);

        const apiError = new Error('Admin API connection failed');
        const mockApiClient = {
          get: jest.fn().mockRejectedValue(apiError),
        };

        (adminApiServiceV2 as any)['getAdminApiClient'] = jest.fn().mockReturnValue(mockApiClient);

        const result = await (service as any).syncTenantData({ id: 2, name: 'tenant-two' } as EdfiTenant);

        expect(result.status).toBe('ERROR');
        expect(result.message).toContain('Admin API call failed');
        expect(result.error).toBe(apiError);
      });

      it('should return ERROR when persistence fails', async () => {
        const tenantDetailsV2 = {
          odsInstances: [
            {
              id: 1,
              name: 'ODS One',
              instanceType: 'Production',
              educationOrganizations: [
                {
                  educationOrganizationId: 255901,
                  nameOfInstitution: 'School One',
                  discriminator: 'edfi.School',
                },
              ],
            },
          ],
        };

        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenantV2WithEnvironment as EdfiTenant);

        const mockApiClient = {
          get: jest.fn().mockResolvedValue(tenantDetailsV2),
        };

        (adminApiServiceV2 as any)['getAdminApiClient'] = jest.fn().mockReturnValue(mockApiClient);

        const persistError = new Error('Database error');
        jest.spyOn(syncOds, 'persistSyncTenant').mockRejectedValue(persistError);

        entityManager.transaction.mockImplementation(async (callback: any) => {
          return callback(entityManager);
        });

        const result = await (service as any).syncTenantData({ id: 2, name: 'tenant-two' } as EdfiTenant);

        expect(result.status).toBe('ERROR');
        expect(result.error).toBe(persistError);
      });

      it('should handle education organizations with missing optional fields', async () => {
        const detailsWithPartialData = {
          odsInstances: [
            {
              id: 1,
              name: 'ODS One',
              instanceType: 'Production',
              educationOrganizations: [
                {
                  educationOrganizationId: 255901,
                  nameOfInstitution: 'School One',
                  // Missing shortNameOfInstitution and parentId
                  discriminator: 'edfi.School',
                },
              ],
            },
          ],
        };

        edfiTenantsRepository.findOne.mockResolvedValue(mockEdfiTenantV2WithEnvironment as EdfiTenant);

        const mockApiClient = {
          get: jest.fn().mockResolvedValue(detailsWithPartialData),
        };

        (adminApiServiceV2 as any)['getAdminApiClient'] = jest.fn().mockImplementation((tenant) => {
          return mockApiClient;
        });

        const persistSyncTenantSpy = jest
          .spyOn(syncOds, 'persistSyncTenant')
          .mockResolvedValue(undefined);

        entityManager.transaction.mockImplementation(async (callback: any) => {
          return callback(entityManager);
        });

        const result = await (service as any).syncTenantData({ id: 2, name: 'tenant-two' } as EdfiTenant);

        expect(result.status).toBe('SUCCESS');
        expect(persistSyncTenantSpy).toHaveBeenCalled();
        
        // Verify the call arguments
        const callArgs = persistSyncTenantSpy.mock.calls[0][0];
        expect(callArgs.em).toBe(entityManager);
        expect(callArgs.edfiTenant).toMatchObject({
          id: 2,
          name: 'tenant-two',
          sbEnvironmentId: 2,
        });
        expect(callArgs.odss).toHaveLength(1);
        expect(callArgs.odss[0].edorgs).toHaveLength(1);
        expect(callArgs.odss[0].edorgs[0]).toMatchObject({
          educationorganizationid: 255901,
          nameofinstitution: 'School One',
          shortnameofinstitution: null,
          discriminator: 'edfi.School',
          parent: undefined,
        });
      });
    });
  });
});
