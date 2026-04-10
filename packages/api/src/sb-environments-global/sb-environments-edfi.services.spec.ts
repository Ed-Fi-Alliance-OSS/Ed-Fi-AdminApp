/* eslint-disable @typescript-eslint/no-explicit-any */
import { SbEnvironmentsEdFiService } from './sb-environments-edfi.services';

describe('SbEnvironmentsEdFiService', () => {
  let service: SbEnvironmentsEdFiService;

  let sbEnvironmentsRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let startingBlocksServiceV1: {
    saveAdminApiCredentials: jest.Mock;
  };
  let startingBlocksServiceV2: {
    saveAdminApiCredentials: jest.Mock;
  };
  let adminApiServiceV2: {
    getTenants: jest.Mock;
  };
  let edfiTenantsRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let entityManager: {
    transaction: jest.Mock;
  };

  const baseEnvironment = {
    id: 1,
    name: 'Test Environment',
    adminApiUrl: 'https://admin.example.com',
    configPublic: {
      version: 'v2',
      values: {
        meta: {
          mode: 'MultiTenant',
        },
        tenants: {},
      },
    },
    configPrivate: {
      tenants: {},
    },
  } as any;

  const baseCreateDto = {
    name: 'Test Environment',
    environmentLabel: 'test-env',
    adminApiUrl: 'https://admin.example.com',
    odsApiDiscoveryUrl: 'https://api.example.com',
    version: 'v2',
    startingBlocks: false,
    isMultitenant: true,
    tenants: [{ name: 'bootstrap-tenant', odss: [] }],
  } as any;

  beforeEach(() => {
    sbEnvironmentsRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    startingBlocksServiceV1 = {
      saveAdminApiCredentials: jest.fn(),
    };
    startingBlocksServiceV2 = {
      saveAdminApiCredentials: jest.fn(),
    };
    adminApiServiceV2 = {
      getTenants: jest.fn(),
    };
    edfiTenantsRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    entityManager = {
      transaction: jest.fn(),
    };

    service = new SbEnvironmentsEdFiService(
      sbEnvironmentsRepository as any,
      startingBlocksServiceV1 as any,
      startingBlocksServiceV2 as any,
      adminApiServiceV2 as any,
      edfiTenantsRepository as any,
      entityManager as any
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('syncv2Environment (phase 1/2/3 orchestration)', () => {
    it('uses discovered tenants and syncs each tenant from Admin API', async () => {
      const discoveredTenants = [
        { id: 't1', name: 'tenant-1', odsInstances: [] },
        { id: 't2', name: 'tenant-2', odsInstances: [] },
      ];

      jest
        .spyOn(service as any, 'ensureDiscoveryBootstrapCredentials')
        .mockResolvedValue(baseEnvironment);
      adminApiServiceV2.getTenants.mockResolvedValue(discoveredTenants);
      jest
        .spyOn(service as any, 'provisionCredentialsForDiscoveredTenants')
        .mockResolvedValue(baseEnvironment);

      edfiTenantsRepository.findOne
        .mockResolvedValueOnce({ id: 11, name: 'tenant-1', sbEnvironmentId: 1 })
        .mockResolvedValueOnce({ id: 22, name: 'tenant-2', sbEnvironmentId: 1 });
      edfiTenantsRepository.find.mockResolvedValue(discoveredTenants.map((t, i) => ({
        id: i + 1,
        name: t.name,
        sbEnvironmentId: 1,
      })));

      const syncTenantDataFromDiscoverySpy = jest
        .spyOn(service as any, 'syncTenantDataFromDiscovery')
        .mockResolvedValue(undefined);

      const result = await (service as any).syncv2Environment(baseEnvironment, baseCreateDto);

      expect(result).toEqual({ status: 'SUCCESS' });
      expect(adminApiServiceV2.getTenants).toHaveBeenCalledWith(baseEnvironment);
      expect(syncTenantDataFromDiscoverySpy).toHaveBeenCalledTimes(2);
      expect(syncTenantDataFromDiscoverySpy).toHaveBeenNthCalledWith(
        1,
        baseEnvironment,
        baseCreateDto,
        discoveredTenants[0],
        { id: 11, name: 'tenant-1', sbEnvironmentId: 1 },
        undefined
      );
    });

    it('removes orphan tenants immediately after discovered sync', async () => {
      const discoveredTenants = [{ id: 't1', name: 'tenant-1', odsInstances: [] }];

      jest
        .spyOn(service as any, 'ensureDiscoveryBootstrapCredentials')
        .mockResolvedValue(baseEnvironment);
      adminApiServiceV2.getTenants.mockResolvedValue(discoveredTenants);
      jest
        .spyOn(service as any, 'provisionCredentialsForDiscoveredTenants')
        .mockResolvedValue(baseEnvironment);
      jest
        .spyOn(service as any, 'syncTenantDataFromDiscovery')
        .mockResolvedValue(undefined);

      edfiTenantsRepository.findOne.mockResolvedValue({
        id: 11,
        name: 'tenant-1',
        sbEnvironmentId: 1,
      });
      edfiTenantsRepository.find.mockResolvedValue([
        { id: 11, name: 'tenant-1', sbEnvironmentId: 1 },
        { id: 33, name: 'orphan-tenant', sbEnvironmentId: 1 },
      ]);

      await (service as any).syncv2Environment(baseEnvironment, baseCreateDto);

      expect(edfiTenantsRepository.delete).toHaveBeenCalledWith([33]);
    });

    it('retains and syncs tenant when discovered odsInstances is empty', async () => {
      const discoveredTenants = [{ id: 't-empty', name: 'tenant-empty', odsInstances: [] }];

      jest
        .spyOn(service as any, 'ensureDiscoveryBootstrapCredentials')
        .mockResolvedValue(baseEnvironment);
      adminApiServiceV2.getTenants.mockResolvedValue(discoveredTenants);
      jest
        .spyOn(service as any, 'provisionCredentialsForDiscoveredTenants')
        .mockResolvedValue(baseEnvironment);

      const syncedTenant = {
        id: 55,
        name: 'tenant-empty',
        sbEnvironmentId: 1,
      };
      edfiTenantsRepository.findOne.mockResolvedValue(syncedTenant);
      edfiTenantsRepository.find.mockResolvedValue([syncedTenant]);

      const syncTenantDataFromDiscoverySpy = jest
        .spyOn(service as any, 'syncTenantDataFromDiscovery')
        .mockResolvedValue(undefined);

      const result = await (service as any).syncv2Environment(baseEnvironment, baseCreateDto);

      expect(result).toEqual({ status: 'SUCCESS' });
      expect(syncTenantDataFromDiscoverySpy).toHaveBeenCalledWith(
        baseEnvironment,
        baseCreateDto,
        discoveredTenants[0],
        syncedTenant,
        undefined
      );
      expect(edfiTenantsRepository.delete).not.toHaveBeenCalled();
    });

    it('calls getTenants exactly once with the provisioned environment', async () => {
      jest
        .spyOn(service as any, 'ensureDiscoveryBootstrapCredentials')
        .mockResolvedValue(baseEnvironment);

      const provisionedEnv = { ...baseEnvironment, id: 99 };
      jest
        .spyOn(service as any, 'provisionCredentialsForDiscoveredTenants')
        .mockResolvedValue(provisionedEnv);

      const tenantPayload = [
        { id: 't1', name: 'tenant-1', odsInstances: [{ id: 99, name: 'ods-1', edOrgs: [] }] },
      ];
      adminApiServiceV2.getTenants.mockResolvedValueOnce(tenantPayload);

      const tenantEntity = { id: 11, name: 'tenant-1', sbEnvironmentId: 1 };
      edfiTenantsRepository.findOne.mockResolvedValue(tenantEntity);
      edfiTenantsRepository.find.mockResolvedValue([tenantEntity]);

      const syncSpy = jest
        .spyOn(service as any, 'syncTenantDataFromDiscovery')
        .mockResolvedValue(undefined);

      await (service as any).syncv2Environment(baseEnvironment, baseCreateDto);

      expect(adminApiServiceV2.getTenants).toHaveBeenCalledTimes(1);
      expect(adminApiServiceV2.getTenants).toHaveBeenCalledWith(provisionedEnv);
      expect(syncSpy).toHaveBeenCalledWith(
        provisionedEnv,
        baseCreateDto,
        tenantPayload[0],
        tenantEntity,
        undefined
      );
    });
  });

  describe('phase 2 credential behavior', () => {
    it('bootstraps credentials from cached tenantCredentialsMap when config has no tenants', async () => {
      const envWithoutTenantCreds = {
        ...baseEnvironment,
        configPublic: {
          ...baseEnvironment.configPublic,
          values: {
            ...baseEnvironment.configPublic.values,
            tenants: {},
          },
        },
      };

      const tenantCredentialsMap = new Map([
        [
          'tenant-a',
          {
            clientId: 'client-a',
            clientSecret: 'secret-a',
            displayName: 'display-a',
          },
        ],
      ]);

      edfiTenantsRepository.findOne.mockResolvedValue(null);
      edfiTenantsRepository.save.mockResolvedValue({
        id: 44,
        name: 'tenant-a',
        sbEnvironmentId: 1,
      });
      sbEnvironmentsRepository.findOne.mockResolvedValue({ ...envWithoutTenantCreds, id: 1 });

      const result = await (service as any).ensureDiscoveryBootstrapCredentials(
        envWithoutTenantCreds,
        baseCreateDto,
        tenantCredentialsMap
      );

      expect(startingBlocksServiceV2.saveAdminApiCredentials).toHaveBeenCalledWith(
        { id: 44, name: 'tenant-a', sbEnvironmentId: 1 },
        envWithoutTenantCreds,
        {
          ClientId: 'client-a',
          ClientSecret: 'secret-a',
          url: baseCreateDto.adminApiUrl,
        }
      );
      expect(result.id).toBe(1);
    });

    it('reuses existing tenant rows during bootstrap from tenantCredentialsMap', async () => {
      const envWithoutTenantCreds = {
        ...baseEnvironment,
        configPublic: {
          ...baseEnvironment.configPublic,
          values: { ...baseEnvironment.configPublic.values, tenants: {} },
        },
      };

      const tenantCredentialsMap = new Map([
        ['tenant-a', { clientId: 'client-a', clientSecret: 'secret-a', displayName: 'display-a' }],
      ]);

      const existingTenant = { id: 44, name: 'tenant-a', sbEnvironmentId: 1 };
      edfiTenantsRepository.findOne.mockResolvedValue(existingTenant);
      sbEnvironmentsRepository.findOne.mockResolvedValue({ ...envWithoutTenantCreds, id: 1 });

      await (service as any).ensureDiscoveryBootstrapCredentials(
        envWithoutTenantCreds,
        baseCreateDto,
        tenantCredentialsMap
      );

      expect(edfiTenantsRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'tenant-a', sbEnvironmentId: 1 },
      });
      expect(edfiTenantsRepository.save).not.toHaveBeenCalled();
    });

    it('reuses existing bootstrap tenant row in single-tenant bootstrap path', async () => {
      const envWithoutTenantCreds = {
        ...baseEnvironment,
        configPublic: {
          ...baseEnvironment.configPublic,
          values: { ...baseEnvironment.configPublic.values, tenants: {} },
        },
      };

      const singleTenantDto = {
        ...baseCreateDto,
        isMultitenant: false,
        tenants: [{ name: 'default', odss: [] }],
      };

      const existingBootstrapTenant = { id: 77, name: 'default', sbEnvironmentId: 1 };
      edfiTenantsRepository.findOne.mockResolvedValue(existingBootstrapTenant);

      jest
        .spyOn(service as any, 'createClientCredentials')
        .mockResolvedValue({ clientId: 'c', clientSecret: 's', displayName: 'd' });

      sbEnvironmentsRepository.findOne.mockResolvedValue({ ...envWithoutTenantCreds, id: 1 });

      await (service as any).ensureDiscoveryBootstrapCredentials(
        envWithoutTenantCreds,
        singleTenantDto,
        undefined
      );

      expect(edfiTenantsRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'default', sbEnvironmentId: 1 },
      });
      expect(edfiTenantsRepository.save).not.toHaveBeenCalled();
    });

    it('skips credential creation when tenant already has stored credentials', async () => {
      const envWithCreds = {
        ...baseEnvironment,
        configPublic: {
          ...baseEnvironment.configPublic,
          values: {
            ...baseEnvironment.configPublic.values,
            tenants: {
              'tenant-1': {
                adminApiKey: 'existing-key',
              },
            },
          },
        },
        configPrivate: {
          tenants: {
            'tenant-1': {
              adminApiSecret: 'existing-secret',
            },
          },
        },
      };

      const createClientCredentialsSpy = jest
        .spyOn(service as any, 'createClientCredentials')
        .mockResolvedValue({
          clientId: 'new-client',
          clientSecret: 'new-secret',
          displayName: 'new-display',
        });

      await (service as any).createAdminAPICredentialsV2(
        baseCreateDto,
        { id: 11, name: 'tenant-1', sbEnvironmentId: 1 },
        envWithCreds,
        undefined
      );

      expect(createClientCredentialsSpy).not.toHaveBeenCalled();
      expect(startingBlocksServiceV2.saveAdminApiCredentials).not.toHaveBeenCalled();
    });
  });
});
