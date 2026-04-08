import 'reflect-metadata';
import { EdfiTenant, Edorg, Ods, SbEnvironment } from '@edanalytics/models-server';
import { EducationOrganizationDto } from '@edanalytics/models';
import { EdorgsService } from './edorgs.service';
import { StartingBlocksServiceV2 } from '../starting-blocks';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CustomHttpException } from '../../../utils';
import { persistSyncOds } from '../../../sb-sync/sync-ods';

// Mock the persistSyncOds function
jest.mock('../../../sb-sync/sync-ods', () => ({
  persistSyncOds: jest.fn(),
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('EdorgsService - syncAllEdOrgs', () => {
  let service: EdorgsService;
  let mockEdorgsRepository: Partial<Repository<Edorg>>;
  let mockOdsRepository: Partial<Repository<Ods>>;
  let mockSbServiceV2: Partial<StartingBlocksServiceV2>;
  let mockAdminApiServiceV2: any;
  let mockDataSource: Partial<DataSource>;
  let mockEntityManager: Partial<EntityManager>;

  const mockSbEnvironment: Partial<SbEnvironment> = {
    id: 1,
    name: 'Test Environment',
    adminApiUrl: 'https://api.test.com',
    configPublic: {
      version: 'v2',
      values: {},
    } as any,
  };

  const mockEdfiTenant: Partial<EdfiTenant> = {
    id: 1,
    name: 'test-tenant',
    sbEnvironmentId: 1,
    sbEnvironment: mockSbEnvironment as SbEnvironment,
  };

  beforeEach(() => {
    mockEdorgsRepository = {
      findBy: jest.fn(),
      findOneBy: jest.fn(),
    };

    mockOdsRepository = {
      findOne: jest.fn(),
    };

    mockEntityManager = {};

    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (runInTransaction) => {
        return runInTransaction(mockEntityManager);
      }),
    };

    mockAdminApiServiceV2 = {
      getAllEdOrgsForTenant: jest.fn(),
    };

    mockSbServiceV2 = {};

    service = new EdorgsService(
      mockEdorgsRepository as Repository<Edorg>,
      mockOdsRepository as Repository<Ods>,
      mockSbServiceV2 as StartingBlocksServiceV2,
      mockAdminApiServiceV2,
      mockDataSource as DataSource
    );

    // Clear mock implementations
    jest.clearAllMocks();
  });

  it('should successfully sync all Ed-Orgs when all ODS instances are found', async () => {
    const mockEdOrgs: EducationOrganizationDto[] = [
      {
        instanceId: 1,
        instanceName: 'ODS One',
        educationOrganizationId: 255901,
        nameOfInstitution: 'School One',
        shortNameOfInstitution: 'S1',
        discriminator: 'edfi.School',
        parentId: null,
      },
      {
        instanceId: 2,
        instanceName: 'ODS Two',
        educationOrganizationId: 255902,
        nameOfInstitution: 'School Two',
        shortNameOfInstitution: 'S2',
        discriminator: 'edfi.School',
        parentId: null,
      },
    ];

    const mockOdsOne: Partial<Ods> = {
      id: 10,
      odsInstanceId: 1,
      odsInstanceName: 'ODS One',
      dbName: 'EdFi_Ods_One',
      edfiTenantId: 1,
    };

    const mockOdsTwo: Partial<Ods> = {
      id: 20,
      odsInstanceId: 2,
      odsInstanceName: 'ODS Two',
      dbName: 'EdFi_Ods_Two',
      edfiTenantId: 1,
    };

    // Mock Admin API call
    (mockAdminApiServiceV2.getAllEdOrgsForTenant as jest.Mock).mockResolvedValue(
      mockEdOrgs
    );

    // Mock ODS repository lookups
    (mockOdsRepository.findOne as jest.Mock)
      .mockResolvedValueOnce(mockOdsOne)
      .mockResolvedValueOnce(mockOdsTwo);

    // Mock persistSyncOds
    (persistSyncOds as jest.Mock).mockResolvedValue({
      status: 'SUCCESS',
      data: {
        edorg: { inserted: 1, updated: 0, deleted: 0 },
        ods: { inserted: 0, updated: 0, deleted: 0 },
      },
    });

    const result = await service.syncAllEdOrgs(
      mockSbEnvironment as SbEnvironment,
      mockEdfiTenant as EdfiTenant
    );

    expect(result).toEqual({ synced: 2, skipped: 0 });
    expect(mockAdminApiServiceV2.getAllEdOrgsForTenant).toHaveBeenCalledWith(
      mockEdfiTenant
    );
    expect(mockOdsRepository.findOne).toHaveBeenCalledTimes(2);
    expect(persistSyncOds).toHaveBeenCalledTimes(2);
  });

  it('should skip Ed-Orgs when ODS instance is not found', async () => {
    const mockEdOrgs: EducationOrganizationDto[] = [
      {
        instanceId: 1,
        instanceName: 'ODS One',
        educationOrganizationId: 255901,
        nameOfInstitution: 'School One',
        shortNameOfInstitution: 'S1',
        discriminator: 'edfi.School',
        parentId: null,
      },
      {
        instanceId: 999, // This ODS doesn't exist
        instanceName: 'ODS Missing',
        educationOrganizationId: 255902,
        nameOfInstitution: 'School Two',
        shortNameOfInstitution: 'S2',
        discriminator: 'edfi.School',
        parentId: null,
      },
    ];

    const mockOdsOne: Partial<Ods> = {
      id: 10,
      odsInstanceId: 1,
      odsInstanceName: 'ODS One',
      dbName: 'EdFi_Ods_One',
      edfiTenantId: 1,
    };

    // Mock Admin API call
    (mockAdminApiServiceV2.getAllEdOrgsForTenant as jest.Mock).mockResolvedValue(
      mockEdOrgs
    );

    // Mock ODS repository lookups - first found, second not found
    (mockOdsRepository.findOne as jest.Mock)
      .mockResolvedValueOnce(mockOdsOne)
      .mockResolvedValueOnce(null);

    // Mock persistSyncOds
    (persistSyncOds as jest.Mock).mockResolvedValue({
      status: 'SUCCESS',
      data: {
        edorg: { inserted: 1, updated: 0, deleted: 0 },
        ods: { inserted: 0, updated: 0, deleted: 0 },
      },
    });

    const result = await service.syncAllEdOrgs(
      mockSbEnvironment as SbEnvironment,
      mockEdfiTenant as EdfiTenant
    );

    expect(result).toEqual({ synced: 1, skipped: 1 });
    expect(persistSyncOds).toHaveBeenCalledTimes(1); // Only called for the found ODS
  });

  it('should return zero synced and skipped when no Ed-Orgs are returned', async () => {
    // Mock Admin API call returning empty array
    (mockAdminApiServiceV2.getAllEdOrgsForTenant as jest.Mock).mockResolvedValue([]);

    const result = await service.syncAllEdOrgs(
      mockSbEnvironment as SbEnvironment,
      mockEdfiTenant as EdfiTenant
    );

    expect(result).toEqual({ synced: 0, skipped: 0 });
    expect(mockOdsRepository.findOne).not.toHaveBeenCalled();
    expect(persistSyncOds).not.toHaveBeenCalled();
  });

  it('should skip Ed-Orgs with null or undefined instanceId', async () => {
    const mockEdOrgs: any[] = [
      {
        instanceId: 1,
        educationOrganizationId: 255901,
        nameOfInstitution: 'School One',
      },
      {
        instanceId: null, // Should be skipped
        educationOrganizationId: 255902,
        nameOfInstitution: 'School Two',
      },
      {
        instanceId: undefined, // Should be skipped
        educationOrganizationId: 255903,
        nameOfInstitution: 'School Three',
      },
    ];

    const mockOdsOne: Partial<Ods> = {
      id: 10,
      odsInstanceId: 1,
      dbName: 'EdFi_Ods_One',
    };

    // Mock Admin API call
    (mockAdminApiServiceV2.getAllEdOrgsForTenant as jest.Mock).mockResolvedValue(
      mockEdOrgs
    );

    // Mock ODS repository lookup
    (mockOdsRepository.findOne as jest.Mock).mockResolvedValueOnce(mockOdsOne);

    // Mock persistSyncOds
    (persistSyncOds as jest.Mock).mockResolvedValue({
      status: 'SUCCESS',
      data: {
        edorg: { inserted: 1, updated: 0, deleted: 0 },
        ods: { inserted: 0, updated: 0, deleted: 0 },
      },
    });

    const result = await service.syncAllEdOrgs(
      mockSbEnvironment as SbEnvironment,
      mockEdfiTenant as EdfiTenant
    );

    expect(result).toEqual({ synced: 1, skipped: 0 });
    expect(mockOdsRepository.findOne).toHaveBeenCalledTimes(1);
    expect(persistSyncOds).toHaveBeenCalledTimes(1);
  });

  it('should throw CustomHttpException when Admin API call fails', async () => {
    const apiError = new Error('Admin API connection failed');

    // Mock Admin API call to throw error
    (mockAdminApiServiceV2.getAllEdOrgsForTenant as jest.Mock).mockRejectedValue(
      apiError
    );

    await expect(
      service.syncAllEdOrgs(mockSbEnvironment as SbEnvironment, mockEdfiTenant as EdfiTenant)
    ).rejects.toThrow(CustomHttpException);

    expect(mockOdsRepository.findOne).not.toHaveBeenCalled();
    expect(persistSyncOds).not.toHaveBeenCalled();
  });

  it('should group multiple Ed-Orgs by ODS instance correctly', async () => {
    const mockEdOrgs: EducationOrganizationDto[] = [
      {
        instanceId: 1,
        instanceName: 'ODS One',
        educationOrganizationId: 255901,
        nameOfInstitution: 'School One',
        discriminator: 'edfi.School',
      },
      {
        instanceId: 1, // Same instance as above
        instanceName: 'ODS One',
        educationOrganizationId: 255902,
        nameOfInstitution: 'School Two',
        discriminator: 'edfi.School',
      },
      {
        instanceId: 2,
        instanceName: 'ODS Two',
        educationOrganizationId: 255903,
        nameOfInstitution: 'School Three',
        discriminator: 'edfi.School',
      },
    ];

    const mockOdsOne: Partial<Ods> = {
      id: 10,
      odsInstanceId: 1,
      dbName: 'EdFi_Ods_One',
    };

    const mockOdsTwo: Partial<Ods> = {
      id: 20,
      odsInstanceId: 2,
      dbName: 'EdFi_Ods_Two',
    };

    // Mock Admin API call
    (mockAdminApiServiceV2.getAllEdOrgsForTenant as jest.Mock).mockResolvedValue(
      mockEdOrgs
    );

    // Mock ODS repository lookups
    (mockOdsRepository.findOne as jest.Mock)
      .mockResolvedValueOnce(mockOdsOne)
      .mockResolvedValueOnce(mockOdsTwo);

    // Mock persistSyncOds
    (persistSyncOds as jest.Mock).mockResolvedValue({
      status: 'SUCCESS',
      data: {
        edorg: { inserted: 2, updated: 0, deleted: 0 },
        ods: { inserted: 0, updated: 0, deleted: 0 },
      },
    });

    const result = await service.syncAllEdOrgs(
      mockSbEnvironment as SbEnvironment,
      mockEdfiTenant as EdfiTenant
    );

    expect(result).toEqual({ synced: 3, skipped: 0 });
    expect(persistSyncOds).toHaveBeenCalledTimes(2); // Once per ODS instance
    expect(mockOdsRepository.findOne).toHaveBeenCalledTimes(2);
  });

  it('should use transaction for persistence', async () => {
    const mockEdOrgs: EducationOrganizationDto[] = [
      {
        instanceId: 1,
        instanceName: 'ODS One',
        educationOrganizationId: 255901,
        nameOfInstitution: 'School One',
        shortNameOfInstitution: 'S1',
        discriminator: 'edfi.School',
        parentId: null,
      },
    ];

    const mockOds: Partial<Ods> = {
      id: 10,
      odsInstanceId: 1,
      dbName: 'EdFi_Ods_One',
    };

    (mockAdminApiServiceV2.getAllEdOrgsForTenant as jest.Mock).mockResolvedValue(
      mockEdOrgs
    );
    (mockOdsRepository.findOne as jest.Mock).mockResolvedValue(mockOds);
    (persistSyncOds as jest.Mock).mockResolvedValue({
      status: 'SUCCESS',
      data: {
        edorg: { inserted: 1, updated: 0, deleted: 0 },
        ods: { inserted: 0, updated: 0, deleted: 0 },
      },
    });

    await service.syncAllEdOrgs(
      mockSbEnvironment as SbEnvironment,
      mockEdfiTenant as EdfiTenant
    );

    expect(mockDataSource.transaction).toHaveBeenCalled();
    expect(persistSyncOds).toHaveBeenCalledWith(
      expect.objectContaining({
        em: mockEntityManager,
        edfiTenant: mockEdfiTenant,
        ods: expect.objectContaining({
          id: 1,
          dbName: 'EdFi_Ods_One',
        }),
      })
    );
  });
});
