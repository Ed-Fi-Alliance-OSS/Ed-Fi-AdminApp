# Phase 6: Wire the factory into `AdminApiSyncService`

> Part of the AC-526 implementation plan — see
> [526-plan-00-overview.md](./526-plan-00-overview.md) for goal, architecture, and global
> constraints. Previous phase: [526-plan-05-wire-update.md](./526-plan-05-wire-update.md).
> Next phase: [526-plan-07-verification.md](./526-plan-07-verification.md).

## Task 7: Wire the factory into `AdminApiSyncService`

**Files:**
- Modify: `packages/api/src/sb-sync/edfi/adminapi-sync.service.ts`
- Modify: `packages/api/src/sb-sync/edfi/adminapi-sync.service.spec.ts`

**Interfaces:**
- Consumes: `AdminApiVersionStrategyFactory` (Phase 3).

- [ ] **Step 1: Write the failing tests for v3 sync support**

Add to `adminapi-sync.service.spec.ts` (mirroring the existing v1/v2 `describe` blocks —
read the full existing file first per the "no placeholders" rule, then add):

```typescript
describe('AdminApiSyncService — v3', () => {
  let service: AdminApiSyncService;
  let strategyFactory: { getStrategy: jest.Mock };
  let v3Strategy: {
    version: string;
    getAdminApiService: jest.Mock;
    bootstrapCredentials: jest.Mock;
    provisionCredentialsForNewTenants: jest.Mock;
  };
  let edfiTenantsRepository: { findOne: jest.Mock; save: jest.Mock; find: jest.Mock };
  let sbEnvironmentsRepository: { findOne: jest.Mock };
  let cacheService: { flushAll: jest.Mock };

  const mockSbEnvironmentV3: any = {
    id: 3,
    name: 'Test Environment V3',
    adminApiUrl: 'https://api.test.com',
    version: 'v3',
    configPublic: {
      version: 'v3',
      values: { meta: { mode: 'SingleTenant' }, tenants: { default: { adminApiKey: 'key' } } },
      adminApiUrl: 'https://api.test.com',
    },
    configPrivate: { tenants: { default: { adminApiSecret: 'secret' } } },
  };

  beforeEach(async () => {
    const adminApiServiceV3Mock = {
      getTenants: jest.fn().mockResolvedValue([{ id: 'default', name: 'default', odsInstances: [] }]),
      getAdminApiClient: jest.fn(),
    };

    v3Strategy = {
      version: 'v3',
      getAdminApiService: jest.fn().mockReturnValue(adminApiServiceV3Mock),
      bootstrapCredentials: jest.fn().mockResolvedValue(undefined),
      provisionCredentialsForNewTenants: jest.fn().mockResolvedValue(undefined),
    };
    strategyFactory = { getStrategy: jest.fn().mockReturnValue(v3Strategy) };

    edfiTenantsRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 1, name: 'default', sbEnvironmentId: 3 }),
      save: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    sbEnvironmentsRepository = { findOne: jest.fn().mockResolvedValue(mockSbEnvironmentV3) };
    cacheService = { flushAll: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminApiSyncService,
        { provide: AdminApiServiceV2, useValue: {} },
        { provide: getRepositoryToken(EdfiTenant), useValue: edfiTenantsRepository },
        { provide: getRepositoryToken(SbEnvironment), useValue: sbEnvironmentsRepository },
        { provide: getEntityManagerToken(), useValue: { transaction: jest.fn((cb) => cb({ getRepository: jest.fn() })) } },
        { provide: CacheService, useValue: cacheService },
        { provide: AdminApiVersionStrategyFactory, useValue: strategyFactory },
      ],
    }).compile();

    service = module.get(AdminApiSyncService);
  });

  it('syncEnvironmentData resolves the v3 strategy, bootstraps credentials, and syncs tenants', async () => {
    const result = await service.syncEnvironmentData(mockSbEnvironmentV3);

    expect(strategyFactory.getStrategy).toHaveBeenCalledWith('v3');
    expect(v3Strategy.bootstrapCredentials).toHaveBeenCalled();
    expect(result.status).toBe('SUCCESS');
  });

  it('syncEnvironmentData returns INVALID_VERSION when the factory throws for an unknown version', async () => {
    strategyFactory.getStrategy.mockImplementation(() => {
      throw new Error('Invalid API version: v9');
    });

    const result = await service.syncEnvironmentData({ ...mockSbEnvironmentV3, version: 'v9' } as any);

    expect(result.status).toBe('INVALID_VERSION');
  });
});
```

Note: this new `describe` block drops the direct `AdminApiServiceV1` provider that the
existing v1/v2 `describe` blocks register, since Step 3 below removes that constructor
dependency from `AdminApiSyncService` entirely — keep `AdminApiServiceV2` (still used
directly for `triggerEdOrgRefresh`/`pollJobStatus`) and add
`AdminApiVersionStrategyFactory`. If the existing v1/v2 `describe` blocks still provide
`AdminApiServiceV1` in their `TestingModule`, remove that provider entry from them in
this same pass (an extraneous provider is harmless with Nest's testing module, so this
is a cleanup, not a requirement for tests to pass).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `nx test api --testPathPattern=adminapi-sync.service.spec.ts`
Expected: FAIL — `AdminApiSyncService` does not yet inject `AdminApiVersionStrategyFactory`
and still rejects any version other than `'v1'/'v2'`.

- [ ] **Step 3: Refactor `AdminApiSyncService`**

Update the constructor to inject the factory and drop the direct `AdminApiServiceV1`
injection that is no longer needed for version dispatch (`adminApiServiceV2` stays —
it's still used directly by `triggerEdOrgRefresh`/`pollJobStatus` via
`getAdminApiClientForEnvironment`):

```typescript
  constructor(
    @Inject(AdminApiServiceV2) private adminApiServiceV2: AdminApiServiceV2,
    @InjectRepository(EdfiTenant)
    private edfiTenantsRepository: Repository<EdfiTenant>,
    @InjectRepository(SbEnvironment)
    private sbEnvironmentsRepository: Repository<SbEnvironment>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    @Inject(CacheService) private readonly cacheService: CacheService,
    private readonly strategyFactory: AdminApiVersionStrategyFactory
  ) {
  }
```

Add the import:

```typescript
import { AdminApiVersionStrategyFactory } from '../../admin-api-version-strategy';
```

Delete the now-redundant private methods `provisionCredentialsForNewTenants`,
`createClientCredentials`, and `bootstrapEnvironmentCredentials` (their logic moved to
`V2AdminApiVersionStrategy` in Phase 2).

Replace the version-detection block in `syncEnvironmentData()` (design gap #3):

```typescript
      // Determine API version and select the appropriate strategy
      let strategy;
      try {
        strategy = this.strategyFactory.getStrategy(sbEnvironment.version);
      } catch (error) {
        this.logger.error(`Environment ${sbEnvironment.name} has invalid or missing version: ${sbEnvironment.version}`);
        return {
          status: 'INVALID_VERSION',
          message: (error as Error).message,
        };
      }

      this.logger.log(`Environment ${sbEnvironment.name} is using Admin API version: ${strategy.version}`);

      // For brand-new environments (no stored credentials yet), register credentials
      // first so getTenants() can authenticate successfully.
      await strategy.bootstrapCredentials(sbEnvironment);
      const reloaded = await this.sbEnvironmentsRepository.findOne({ where: { id: sbEnvironment.id } });
      if (reloaded) sbEnvironment = reloaded;

      // Discover tenants from the Admin API
      this.logger.log(`Discovering tenants for environment: ${sbEnvironment.name}`);
      const adminApiService = strategy.getAdminApiService();
      let tenants: TenantDto[] = await adminApiService.getTenants(sbEnvironment);
```

Replace the `version === 'v2'` branch condition that follows (the bulk of the v2-specific
sync loop) with `strategy.version !== 'v1'` (v2 and v3 share the same per-tenant sync
path via `syncTenantData()`):

```typescript
      if (strategy.version !== 'v1') {
        const configPublic = sbEnvironment.configPublic;
        const isMultiTenant =
          configPublic?.version !== undefined &&
          configPublic.version !== 'v1' &&
          (configPublic.values as { meta?: { mode?: string } })?.meta?.mode === 'MultiTenant';

        if (isMultiTenant) {
          await strategy.provisionCredentialsForNewTenants(sbEnvironment, tenants);

          const reloadedEnvironment = await this.sbEnvironmentsRepository.findOne({
            where: { id: sbEnvironment.id },
          });
          if (reloadedEnvironment) {
            sbEnvironment = reloadedEnvironment;
          }
        }
```

(Leave the remainder of that branch — EdOrg refresh trigger/poll, per-tenant loop calling
`this.syncTenantData(edfiTenant)`, orphaned-tenant cleanup — unchanged; it already only
depends on `sbEnvironment`/`tenants`, not on a `version === 'v2'` literal.)

Replace the version-detection block in `syncTenantData()` (design gap #3, second
occurrence):

```typescript
      // Determine API version and select the appropriate strategy
      let strategy;
      try {
        strategy = this.strategyFactory.getStrategy(version);
      } catch (error) {
        this.logger.error(`Environment for tenant ${edfiTenant.name} has invalid version: ${version}`);
        return {
          status: 'INVALID_VERSION',
          message: (error as Error).message,
        };
      }

      // V1 is single-tenant, so individual tenant sync is not supported
      if (strategy.version === 'v1') {
        this.logger.warn(`Tenant sync not supported for v1 environments. Use environment-level sync instead.`);
        return {
          status: 'ERROR',
          message: 'V1 Admin API is single-tenant. Use syncEnvironmentData to sync all data.',
        };
      }

      this.logger.log(`Syncing tenant ${edfiTenant.name} using Admin API ${strategy.version}`);
```

Replace the `'version' in configPublic && configPublic.version === 'v2'` checks further
down in `syncTenantData()` with `configPublic.version === strategy.version` (so v3
environments read their own `configPublic.values`/`configPrivate` instead of being
rejected):

```typescript
      const configPublic = sbEnvironment.configPublic;
      const configPrivate = sbEnvironment.configPrivate;
      const tenantConfig =
        'version' in configPublic && configPublic.version === strategy.version ? configPublic.values : undefined;
      const tenantConfigPrivateAll =
        'version' in configPublic && configPublic.version === strategy.version
          ? (configPrivate as ISbEnvironmentConfigPrivateV2)
          : undefined;

      if (!tenantConfig || !tenantConfigPrivateAll) {
        this.logger.error(`Environment configuration is not ${strategy.version} format for tenant ${edfiTenant.name}`);
        return {
          status: 'ERROR',
          message: `Environment is not configured for Admin API ${strategy.version}`,
        };
      }
```

(Rename the local variables used afterward — `v2Config`/`v2ConfigPrivate` →
`tenantConfig`/`tenantConfigPrivateAll` — consistently through the rest of the method
body where they're referenced for `tenants[edfiTenant.name]` lookups.)

Replace the hardcoded `this.adminApiServiceV2.getAdminApiClient(tenantWithEnvironment)`
call with `strategy.getAdminApiService().getAdminApiClient(tenantWithEnvironment)` so V3
tenants call the V3 client (V3's route base is `/v3/` vs V2's `/v2/`, and the endpoint
path itself differs: V2 uses `tenants/{name}/odsInstances/edOrgs`, V3 uses
`tenants/{name}/dataStores/edOrgs` — see `AdminApiServiceV3.getTenants()` for the
V3-specific route). Change the endpoint construction to ask the strategy's own service,
not to hardcode a path string:

```typescript
      // Fetch tenant details using the version-appropriate client and endpoint
      const versionedApiService = strategy.getAdminApiService();
      const endpoint =
        strategy.version === 'v3'
          ? `tenants/${edfiTenant.name}/dataStores/edOrgs`
          : `tenants/${edfiTenant.name}/odsInstances/edOrgs`;

      this.logger.log(`Fetching tenant details from Admin API: ${endpoint}`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let tenantDetails: any;
      try {
        tenantDetails = await versionedApiService.getAdminApiClient(tenantWithEnvironment).get(endpoint);
      } catch (apiError) {
```

and further down, map the response using the version-appropriate field name (`dataStores`
for v3, `odsInstances` for v2 — matching the 524-design.md route-rename table):

```typescript
      const rawInstances =
        strategy.version === 'v3' ? tenantDetails.dataStores : tenantDetails.odsInstances;

      // Transform the response to TenantDto format
      const tenantDto: TenantDto = {
        id: tenantDetails.id || edfiTenant.name,
        name: tenantDetails.name || edfiTenant.name,
        odsInstances: (rawInstances || []).map((instance: any) => ({
          id: instance.id ?? null,
          name: instance.name || 'Unknown ODS Instance',
          instanceType: instance.instanceType ?? instance.dataStoreType,
          status: instance.status ?? null,
          databaseTemplate: instance.databaseTemplate ?? null,
          databaseName: instance.databaseName ?? null,
          edOrgs: (instance.educationOrganizations || []).map((edOrg: any) => ({
            instanceId: instance.id,
            instanceName: instance.name,
            educationOrganizationId: edOrg.educationOrganizationId,
            nameOfInstitution: edOrg.nameOfInstitution,
            shortNameOfInstitution: edOrg.shortNameOfInstitution,
            discriminator: edOrg.discriminator,
            parentId: edOrg.parentId,
          })),
        })),
      };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `nx test api --testPathPattern=adminapi-sync.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Run the full test suite to confirm no v1/v2 regressions**

Run: `nx test api`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/sb-sync/edfi/adminapi-sync.service.ts packages/api/src/sb-sync/edfi/adminapi-sync.service.spec.ts
git commit -m "feat(AC-526): wire AdminApiSyncService to AdminApiVersionStrategyFactory, add V3 sync support"
```

Next: [526-plan-07-verification.md](./526-plan-07-verification.md).
