import 'reflect-metadata';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { SbEnvironmentsGlobalService } from './sb-environments-global.service';

describe('SbEnvironmentsGlobalService - updateAdminApi', () => {
  let service: SbEnvironmentsGlobalService;
  let mockRepository: { save: jest.Mock };
  let mockAdminApiServiceV1: any;
  let mockStartingBlocksServiceV1: { saveAdminApiCredentials: jest.Mock };
  let mockStartingBlocksServiceV2: { saveAdminApiCredentials: jest.Mock };
  let mockEdfiTenantService: { pingAdminApi: jest.Mock };

  const updateDto = {
    adminKey: 'key',
    adminSecret: 'secret',
    url: 'https://api.test.com',
    modifiedById: 1,
  };

  beforeEach(() => {
    mockRepository = {
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };
    mockAdminApiServiceV1 = {};
    mockStartingBlocksServiceV1 = { saveAdminApiCredentials: jest.fn().mockResolvedValue(undefined) };
    mockStartingBlocksServiceV2 = { saveAdminApiCredentials: jest.fn().mockResolvedValue(undefined) };
    mockEdfiTenantService = {
      pingAdminApi: jest.fn().mockResolvedValue(undefined),
    };

    service = new SbEnvironmentsGlobalService(
      mockRepository as any,
      mockAdminApiServiceV1,
      mockStartingBlocksServiceV1 as any,
      mockStartingBlocksServiceV2 as any,
      mockEdfiTenantService as any
    );
  });

  it('reuses StartingBlocksServiceV2.saveAdminApiCredentials for v3 environments', async () => {
    const sbEnvironment = { version: 'v3' } as SbEnvironment;
    const edfiTenant = { sbEnvironmentId: 1 } as EdfiTenant;

    await service.updateAdminApi(sbEnvironment, edfiTenant, updateDto as any);

    expect(mockStartingBlocksServiceV2.saveAdminApiCredentials).toHaveBeenCalledWith(
      edfiTenant,
      sbEnvironment,
      { ClientId: 'key', ClientSecret: 'secret', url: 'https://api.test.com' }
    );
    expect(mockStartingBlocksServiceV1.saveAdminApiCredentials).not.toHaveBeenCalled();
  });

  it('still uses StartingBlocksServiceV2.saveAdminApiCredentials for v2 environments (unchanged)', async () => {
    const sbEnvironment = { version: 'v2' } as SbEnvironment;
    const edfiTenant = { sbEnvironmentId: 1 } as EdfiTenant;

    await service.updateAdminApi(sbEnvironment, edfiTenant, updateDto as any);

    expect(mockStartingBlocksServiceV2.saveAdminApiCredentials).toHaveBeenCalledWith(
      edfiTenant,
      sbEnvironment,
      { ClientId: 'key', ClientSecret: 'secret', url: 'https://api.test.com' }
    );
  });

  it('still throws for an unrecognized version (unchanged)', async () => {
    const sbEnvironment = { version: undefined } as unknown as SbEnvironment;
    const edfiTenant = { sbEnvironmentId: 1 } as EdfiTenant;

    await expect(
      service.updateAdminApi(sbEnvironment, edfiTenant, updateDto as any)
    ).rejects.toThrow('Environment does not have an established version. Please sync metadata first.');
  });
});
