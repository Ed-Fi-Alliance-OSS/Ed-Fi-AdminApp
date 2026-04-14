import 'reflect-metadata';
import { InternalServerErrorException } from '@nestjs/common';
import { SbEnvironment, EdfiTenant } from '@edanalytics/models-server';
import { Repository, EntityManager } from 'typeorm';
import { SbEnvironmentsEdFiService } from './sb-environments-edfi.services';
import {
  AdminApiServiceV2,
  StartingBlocksServiceV1,
  StartingBlocksServiceV2,
} from '../teams/edfi-tenants/starting-blocks';
import { PostSbEnvironmentDto, TenantDto } from '@edanalytics/models';
import { persistSyncTenant } from '../sb-sync/sync-ods';
import { transformTenantData } from '../utils/admin-api-data-adapter-utils';
import * as utils from '../utils';
import axios from 'axios';

// ---------------------------------------------------------------------------
// Tenancy response builders for axios.create root client mock
// ---------------------------------------------------------------------------

const makeSingleTenancyResponse = () => ({ data: {} });

const makeMultiTenancyResponse = (tenants: string[]) => ({
  data: { tenancy: { multitenantMode: true, tenants } },
});

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

jest.mock('axios');

jest.mock('../utils', () => {
  const actual = jest.requireActual('../utils');
  return {
    ...actual,
    validateAdminApiUrl: jest.fn().mockResolvedValue(undefined),
    fetchOdsApiMetadata: jest.fn(),
    determineVersionFromMetadata: jest.fn(),
    determineTenantModeFromMetadata: jest.fn(),
  };
});

jest.mock('../sb-sync/sync-ods', () => ({
  persistSyncTenant: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/admin-api-data-adapter-utils', () => ({
  transformTenantData: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Typed references to mocked functions
// ---------------------------------------------------------------------------

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedPersistSyncTenant = persistSyncTenant as jest.MockedFunction<typeof persistSyncTenant>;
const mockedTransformTenantData = transformTenantData as jest.MockedFunction<typeof transformTenantData>;
const mockedFetchOdsApiMetadata = utils.fetchOdsApiMetadata as jest.MockedFunction<typeof utils.fetchOdsApiMetadata>;
const mockedDetermineVersion = utils.determineVersionFromMetadata as jest.MockedFunction<typeof utils.determineVersionFromMetadata>;
const mockedDetermineTenantMode = utils.determineTenantModeFromMetadata as jest.MockedFunction<typeof utils.determineTenantModeFromMetadata>;
const mockedValidateAdminApiUrl = utils.validateAdminApiUrl as jest.MockedFunction<typeof utils.validateAdminApiUrl>;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const makeEnv = (overrides: Partial<SbEnvironment> = {}): SbEnvironment =>
  ({
    id: 1,
    name: 'Test Env',
    adminApiUrl: 'https://admin.test.local',
    configPublic: {
      version: 'v2',
      adminApiUrl: 'https://admin.test.local',
      values: { tenants: {}, meta: { mode: 'SingleTenant' } },
    },
    configPrivate: { tenants: {} },
    ...overrides,
  } as unknown as SbEnvironment);

const makeEdfiTenant = (name: string, id = 10): EdfiTenant =>
  ({ id, name, sbEnvironmentId: 1 } as unknown as EdfiTenant);

const makeTenantDto = (name: string, withOds = false): TenantDto => ({
  id: name,
  name,
  odsInstances: withOds
    ? [
        {
          id: 101,
          name: 'ODS One',
          instanceType: 'Production',
          edOrgs: [
            {
              instanceId: 101,
              instanceName: 'ODS One',
              educationOrganizationId: 255901,
              nameOfInstitution: 'Test School',
              shortNameOfInstitution: 'TS',
              discriminator: 'edfi.School',
              parentId: undefined,
            },
          ],
        },
      ]
    : [],
});

const makeV2CreateDto = (isMultitenant = false, tenantNames: string[] = []): PostSbEnvironmentDto =>
  ({
    name: 'Test Env',
    adminApiUrl: 'https://admin.test.local',
    odsApiDiscoveryUrl: 'https://ods.test.local',
    version: 'v2',
    startingBlocks: false,
    isMultitenant,
    tenants: tenantNames.map(name => ({ name, odss: [] })),
  } as unknown as PostSbEnvironmentDto);

const makeV1CreateDto = (): PostSbEnvironmentDto =>
  ({
    name: 'Test Env',
    adminApiUrl: 'https://admin.test.local',
    odsApiDiscoveryUrl: 'https://ods.test.local',
    version: 'v1',
    startingBlocks: false,
    isMultitenant: false,
    tenants: [{ name: 'default', odss: [] }],
  } as unknown as PostSbEnvironmentDto);

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('SbEnvironmentsEdFiService', () => {
  let service: SbEnvironmentsEdFiService;
  let adminApiServiceV2: jest.Mocked<Pick<AdminApiServiceV2, 'getTenants' | 'getTenantNames' | 'getTenantOdsInstances'>>;
  let sbEnvironmentsRepo: jest.Mocked<Pick<Repository<SbEnvironment>, 'create' | 'save' | 'findOne' | 'find'>>;
  let edfiTenantsRepo: jest.Mocked<Pick<Repository<EdfiTenant>, 'findOne' | 'find' | 'save' | 'delete'>>;
  let entityManager: { transaction: jest.Mock };
  let startingBlocksServiceV2: jest.Mocked<Pick<StartingBlocksServiceV2, 'saveAdminApiCredentials'>>;
  let startingBlocksServiceV1: jest.Mocked<Pick<StartingBlocksServiceV1, 'saveAdminApiCredentials'>>;

  /** Mock for the GET / call on the root client created by axios.create */
  let mockRootGet: jest.Mock;

  const savedEnv = makeEnv();

  beforeEach(() => {
    jest.clearAllMocks();

    adminApiServiceV2 = {
      getTenants: jest.fn(),
      getTenantNames: jest.fn().mockResolvedValue(['default']),
      getTenantOdsInstances: jest.fn().mockResolvedValue([]),
    };
    sbEnvironmentsRepo = {
      create: jest.fn().mockReturnValue(savedEnv),
      save: jest.fn().mockResolvedValue(savedEnv),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    };
    edfiTenantsRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ id: 10, ...data })),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    entityManager = {
      transaction: jest.fn().mockImplementation((cb) => cb({})),
    };
    startingBlocksServiceV2 = { saveAdminApiCredentials: jest.fn().mockResolvedValue(undefined) };
    startingBlocksServiceV1 = { saveAdminApiCredentials: jest.fn().mockResolvedValue(undefined) };

    // Mock for direct axios.post calls (createClientCredentials registers clients)
    mockedAxios.post = jest.fn().mockResolvedValue({ status: 200, data: {} });

    // Mock for axios.create (Pre-Phase root endpoint discovery — GET / is public, no auth)
    // Default: single-tenant mode (no tenancy.tenants in response)
    mockRootGet = jest.fn().mockResolvedValue(makeSingleTenancyResponse());
    mockedAxios.create = jest.fn().mockReturnValue({ get: mockRootGet });

    // Default metadata mocks (v2 single-tenant)
    mockedFetchOdsApiMetadata.mockResolvedValue({ version: '2.0' } as any);
    mockedDetermineVersion.mockReturnValue('v2');
    mockedDetermineTenantMode.mockReturnValue('SingleTenant');
    mockedValidateAdminApiUrl.mockResolvedValue(undefined);

    // Default transformTenantData returns empty ODS list
    mockedTransformTenantData.mockReturnValue({ odss: [] } as any);

    service = new SbEnvironmentsEdFiService(
      sbEnvironmentsRepo as any,
      startingBlocksServiceV1 as any,
      startingBlocksServiceV2 as any,
      adminApiServiceV2 as any,
      edfiTenantsRepo as any,
      entityManager as unknown as EntityManager
    );
  });

  // -------------------------------------------------------------------------
  // v2 create path
  // -------------------------------------------------------------------------

  describe('v2 create: syncv2Environment is driven by Admin API root endpoint discovery', () => {

    it('discovers tenant names from Admin API root endpoint, ignoring DTO tenant list', async () => {
      // getTenantNames returns the authoritative list; DTO tenant list is ignored
      adminApiServiceV2.getTenantNames.mockResolvedValue(['api-tenant']);
      mockedDetermineTenantMode.mockReturnValue('MultiTenant');

      await service.create(makeV2CreateDto(true, ['dto-tenant-wrong']), undefined);

      // Only 'api-tenant' (from root endpoint) must be bootstrapped; DTO name must be ignored
      expect(edfiTenantsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'api-tenant' })
      );
      expect(edfiTenantsRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: 'dto-tenant-wrong' })
      );
    });

    it("uses 'default' as bootstrap tenant when root endpoint returns single-tenant mode", async () => {
      // Default getTenantNames mock returns ['default'] for single-tenant

      await service.create(makeV2CreateDto(), undefined);

      expect(edfiTenantsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'default' })
      );
    });

    it('throws when Admin API root endpoint is unreachable', async () => {
      adminApiServiceV2.getTenantNames.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.create(makeV2CreateDto(), undefined)).rejects.toThrow();
    });

    it('bootstraps credentials before fetching ODS instances so auth is ready', async () => {
      edfiTenantsRepo.findOne
        .mockResolvedValueOnce(null)                       // Phase A: not found → save
        .mockResolvedValueOnce(makeEdfiTenant('default')); // Phase B: found → getTenantOdsInstances called

      await service.create(makeV2CreateDto(), undefined);

      // Phase A bootstrap (saveAdminApiCredentials) MUST happen before Phase B ODS fetch (getTenantOdsInstances)
      const saveCalls = (startingBlocksServiceV2.saveAdminApiCredentials as jest.Mock).mock.invocationCallOrder;
      const getOdsInstancesCalls = (adminApiServiceV2.getTenantOdsInstances as jest.Mock).mock.invocationCallOrder;
      expect(saveCalls[0]).toBeLessThan(getOdsInstancesCalls[0]);
    });

    it('calls adminApiServiceV2.getTenantNames with the saved environment', async () => {

      await service.create(makeV2CreateDto(), undefined);

      expect(adminApiServiceV2.getTenantNames).toHaveBeenCalledWith(savedEnv);
    });

    it('ODS data comes from API discovery, not from DTO tenant list', async () => {
      // getTenantNames returns 'api-tenant'; DTO has no tenants — tenant name comes from API
      adminApiServiceV2.getTenantNames.mockResolvedValue(['api-tenant']);
      mockedDetermineTenantMode.mockReturnValue('MultiTenant');

      await service.create(makeV2CreateDto(), undefined);

      expect(edfiTenantsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'api-tenant' })
      );
    });

    it('succeeds and skips all processing when getTenantNames returns empty list', async () => {
      adminApiServiceV2.getTenantNames.mockResolvedValue([]);

      await expect(service.create(makeV2CreateDto(), undefined)).resolves.toBeDefined();

      // 0 tenants from getTenantNames → no credential bootstrap and no ODS persistence
      expect(startingBlocksServiceV2.saveAdminApiCredentials).not.toHaveBeenCalled();
      // No ODS data should be persisted
      expect(mockedPersistSyncTenant).not.toHaveBeenCalled();
    });

    it('bootstraps credentials for all tenants returned by root endpoint in multi-tenant mode', async () => {
      adminApiServiceV2.getTenantNames.mockResolvedValue(['tenant-a', 'tenant-b']);
      mockedDetermineTenantMode.mockReturnValue('MultiTenant');

      await service.create(makeV2CreateDto(true), undefined);

      expect(startingBlocksServiceV2.saveAdminApiCredentials).toHaveBeenCalledTimes(2);
      expect(startingBlocksServiceV2.saveAdminApiCredentials).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'tenant-a' }),
        savedEnv,
        expect.objectContaining({ ClientId: expect.any(String), ClientSecret: expect.any(String) })
      );
      expect(startingBlocksServiceV2.saveAdminApiCredentials).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'tenant-b' }),
        savedEnv,
        expect.objectContaining({ ClientId: expect.any(String), ClientSecret: expect.any(String) })
      );
    });

    it('bootstraps credentials only for tenants returned by getTenantNames', async () => {
      // getTenantNames is the sole source of tenant names; no additional provisioning from other sources
      adminApiServiceV2.getTenantNames.mockResolvedValue(['tenant-a']);
      mockedDetermineTenantMode.mockReturnValue('MultiTenant');

      await service.create(makeV2CreateDto(true), undefined);

      // Only 1 credential call — only tenant-a was returned by getTenantNames
      expect(startingBlocksServiceV2.saveAdminApiCredentials).toHaveBeenCalledTimes(1);
      expect(startingBlocksServiceV2.saveAdminApiCredentials).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'tenant-a' }),
        expect.anything(),
        expect.objectContaining({ ClientId: expect.any(String) })
      );
    });

    it('single-tenant bootstrap uses no tenant header on credential registration', async () => {
      // Default getTenantNames mock returns ['default'] → bootstraps without tenant header

      await service.create(makeV2CreateDto(false), undefined);

      const axiosCallHeaders = (mockedAxios.post as jest.Mock).mock.calls[0]?.[2]?.headers ?? {};
      expect(axiosCallHeaders).not.toHaveProperty('tenant');
    });

    it('multi-tenant bootstrap uses tenant header per tenant name from root endpoint', async () => {
      adminApiServiceV2.getTenantNames.mockResolvedValue(['my-tenant']);
      mockedDetermineTenantMode.mockReturnValue('MultiTenant');

      await service.create(makeV2CreateDto(true), undefined);

      // First axios.post is the bootstrap register call — must carry the tenant header
      const axiosCallHeaders = (mockedAxios.post as jest.Mock).mock.calls[0]?.[2]?.headers ?? {};
      expect(axiosCallHeaders).toHaveProperty('tenant', 'my-tenant');
    });

    it('persists discovered tenant ODS data via persistSyncTenant', async () => {
      edfiTenantsRepo.findOne
        .mockResolvedValueOnce(null)                       // Phase A bootstrap: not found → save
        .mockResolvedValueOnce(makeEdfiTenant('default')); // Phase B ODS pass: found

      adminApiServiceV2.getTenantOdsInstances.mockResolvedValue([
        { id: 101, name: 'ODS One', dbName: 'ODS One', edorgs: [] },
      ] as any);

      await service.create(makeV2CreateDto(), undefined);

      // transformTenantData is not used in the v2 path — mapping is done inside getTenantOdsInstances
      expect(mockedTransformTenantData).not.toHaveBeenCalled();
      expect(mockedPersistSyncTenant).toHaveBeenCalledWith(
        expect.objectContaining({
          odss: expect.arrayContaining([
            expect.objectContaining({ id: 101, name: 'ODS One', dbName: 'ODS One' }),
          ]),
        })
      );
    });

    it('getTenantNames failure propagates to the create error handler as InternalServerErrorException', async () => {
      adminApiServiceV2.getTenantNames.mockRejectedValue(new Error('Network error'));

      await expect(service.create(makeV2CreateDto(), undefined)).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it('tenant with empty odsInstances creates the tenant row and calls persistSyncTenant with empty list', async () => {
      edfiTenantsRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeEdfiTenant('default'));
      // Default getTenantOdsInstances mock returns [] — empty ODS list

      await expect(service.create(makeV2CreateDto(), undefined)).resolves.toBeDefined();

      expect(edfiTenantsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'default' })
      );
      expect(mockedPersistSyncTenant).toHaveBeenCalledWith(
        expect.objectContaining({ odss: [] })
      );
    });
  });

  // -------------------------------------------------------------------------
  // v2 create: obsolete validateTenantsAndCreateCredentials no longer called
  // -------------------------------------------------------------------------

  describe('v2 create: pre-flight DTO validation map is removed', () => {
    it('does not call validateTenantsAndCreateCredentials during v2 multi-tenant create', async () => {
      adminApiServiceV2.getTenantNames.mockResolvedValue(['t1']);
      mockedDetermineTenantMode.mockReturnValue('MultiTenant');

      const validateSpy = jest.spyOn(service as any, 'validateTenantsAndCreateCredentials');

      await service.create(makeV2CreateDto(true), undefined);

      expect(validateSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // v1 create path — regression guard
  // -------------------------------------------------------------------------

  describe('v1 create: unchanged path', () => {
    const savedEnvV1 = {
      ...makeEnv(),
      configPublic: {
        version: 'v1',
        adminApiUrl: 'https://admin.test.local',
        odsApiMeta: { version: '1.3' },
        startingBlocks: false,
        values: { edfiHostname: 'ods.test.local', adminApiUrl: 'https://admin.test.local' },
      },
    };

    beforeEach(() => {
      mockedFetchOdsApiMetadata.mockResolvedValue({ version: '1.3' } as any);
      mockedDetermineVersion.mockReturnValue('v1');
      mockedDetermineTenantMode.mockReturnValue('SingleTenant');
      sbEnvironmentsRepo.create = jest.fn().mockReturnValue(savedEnvV1 as any);
      sbEnvironmentsRepo.save = jest.fn().mockResolvedValue(savedEnvV1 as any);
      edfiTenantsRepo.find.mockResolvedValue([]);
    });

    it('uses v1 sync path and does not call adminApiServiceV2.getTenants or getTenantNames', async () => {
      await service.create(makeV1CreateDto(), undefined);

      expect(adminApiServiceV2.getTenants).not.toHaveBeenCalled();
      expect(adminApiServiceV2.getTenantNames).not.toHaveBeenCalled();
      expect(startingBlocksServiceV1.saveAdminApiCredentials).toHaveBeenCalledWith(
        savedEnvV1,
        expect.objectContaining({ ClientId: expect.any(String) })
      );
      expect(startingBlocksServiceV2.saveAdminApiCredentials).not.toHaveBeenCalled();
    });

    it('does not call the Admin API root endpoint for v1 environments', async () => {
      await service.create(makeV1CreateDto(), undefined);

      // getTenantNames is only called in v2 Pre-Phase; must be absent for v1
      expect(adminApiServiceV2.getTenantNames).not.toHaveBeenCalled();
      expect(adminApiServiceV2.getTenants).not.toHaveBeenCalled();
    });
  });
});
