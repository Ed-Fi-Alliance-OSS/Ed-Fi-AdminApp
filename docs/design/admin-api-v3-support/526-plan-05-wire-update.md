# Phase 5: Wire the factory into `SbEnvironmentsEdFiService.updateEnvironment()`

> Part of the AC-526 implementation plan — see
> [526-plan-00-overview.md](./526-plan-00-overview.md) for goal, architecture, and global
> constraints. Previous phase: [526-plan-04-wire-create.md](./526-plan-04-wire-create.md).
> Next phase: [526-plan-06-wire-sync.md](./526-plan-06-wire-sync.md).

## Task 6: Wire the factory into `SbEnvironmentsEdFiService.updateEnvironment()`

**Files:**
- Modify: `packages/api/src/sb-environments-global/sb-environments-edfi.services.ts`
- Modify: `packages/api/src/sb-environments-global/sb-environments-edfi.services.spec.ts`

**Interfaces:**
- Consumes: `AdminApiVersionStrategyFactory` (Phase 3), `strategy.getTenantModeDefault`,
  `strategy.applyOdsUrlUpdate`, `strategy.shouldTriggerResync`, `strategy.dispatchSync`,
  `strategy.supportsMultiTenant` (Phases 1–3).

- [ ] **Step 1: Write the failing tests for v3 update support**

Add to `sb-environments-edfi.services.spec.ts`:

```typescript
describe('SbEnvironmentsEdFiService.updateEnvironment (v3)', () => {
  let service: SbEnvironmentsEdFiService;
  let sbEnvironmentsRepository: { findOne: jest.Mock; save: jest.Mock };
  let strategyFactory: { getStrategy: jest.Mock };
  let v3Strategy: {
    version: string;
    supportsMultiTenant: boolean;
    getTenantModeDefault: jest.Mock;
    applyOdsUrlUpdate: jest.Mock;
    shouldTriggerResync: jest.Mock;
    dispatchSync: jest.Mock;
  };

  const existingV3Environment = {
    id: 5,
    adminApiUrl: 'https://api.test.com',
    configPublic: {
      version: 'v3',
      adminApiUrl: 'https://api.test.com',
      values: { meta: { mode: 'MultiTenant', domainName: 'old.test.com' }, tenants: { default: {} } },
    },
  };

  beforeEach(async () => {
    v3Strategy = {
      version: 'v3',
      supportsMultiTenant: true,
      getTenantModeDefault: jest.fn().mockReturnValue(true),
      applyOdsUrlUpdate: jest.fn().mockReturnValue({ meta: { mode: 'MultiTenant', domainName: 'new.test.com' } }),
      shouldTriggerResync: jest.fn().mockReturnValue(true),
      dispatchSync: jest.fn().mockResolvedValue({ kind: 'queued', syncQueue: { id: 'job-2', state: 'completed' } }),
    };
    strategyFactory = { getStrategy: jest.fn().mockReturnValue(v3Strategy) };

    sbEnvironmentsRepository = {
      findOne: jest.fn().mockResolvedValue(existingV3Environment),
      save: jest.fn(async (v) => v),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SbEnvironmentsEdFiService,
        { provide: getRepositoryToken(SbEnvironment), useValue: sbEnvironmentsRepository },
        { provide: StartingBlocksServiceV1, useValue: { saveAdminApiCredentials: jest.fn() } },
        { provide: StartingBlocksServiceV2, useValue: {} },
        { provide: getRepositoryToken(EdfiTenant), useValue: { find: jest.fn(), save: jest.fn() } },
        { provide: getEntityManagerToken(), useValue: { transaction: jest.fn() } },
        { provide: 'IJobQueueService', useValue: { send: jest.fn() } },
        { provide: getRepositoryToken(SbSyncQueue), useValue: { findOneBy: jest.fn() } },
        { provide: AdminApiVersionStrategyFactory, useValue: strategyFactory },
      ],
    }).compile();

    service = module.get(SbEnvironmentsEdFiService);
  });

  it('accepts isMultitenant:true for an existing v3 multi-tenant environment (tenant-mode lock)', async () => {
    (utils.validateAdminApiUrl as jest.Mock).mockResolvedValue({ specificationVersion: 'v3' });

    await expect(
      service.updateEnvironment(5, { isMultitenant: true } as any, undefined)
    ).resolves.toBeDefined();

    expect(v3Strategy.getTenantModeDefault).toHaveBeenCalledWith(existingV3Environment);
  });

  it('rejects isMultitenant:false for an existing v3 multi-tenant environment', async () => {
    await expect(
      service.updateEnvironment(5, { isMultitenant: false } as any, undefined)
    ).rejects.toThrow(/Tenant mode cannot be changed/);
  });

  it('triggers a re-sync via strategy.dispatchSync when the ODS URL changes', async () => {
    await service.updateEnvironment(5, { odsApiDiscoveryUrl: 'https://new.test.com' } as any, undefined);

    expect(v3Strategy.shouldTriggerResync).toHaveBeenCalledWith(true);
    expect(v3Strategy.dispatchSync).toHaveBeenCalled();
  });
});
```

(This `describe` block reuses the imports already added at the top of the spec file in
Phase 4 — `Test`, `TestingModule`, `getRepositoryToken`, `getEntityManagerToken`,
`SbEnvironmentsEdFiService`, `AdminApiVersionStrategyFactory`, `EdfiTenant`,
`SbEnvironment`, `SbSyncQueue`, `StartingBlocksServiceV1`, `StartingBlocksServiceV2`,
`utils`. No new imports are needed.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `nx test api --testPathPattern=sb-environments-edfi.services.spec.ts`
Expected: FAIL — `updateEnvironment()` still uses the `isV1Environment`/`isV2Environment`
chain and never calls `strategyFactory.getStrategy`.

- [ ] **Step 3: Refactor `updateEnvironment()` to use the strategy factory**

Replace the version-detection block (design gap #5) near the top of
`updateEnvironment()`:

```typescript
      // Validate tenant credentials if we're updating URLs and the environment is v2 multi-tenant
      const existingVersion = existingEnvironment.configPublic?.version;
      const existingStrategy = existingVersion ? this.strategyFactory.getStrategy(existingVersion) : undefined;
      const hasUrlUpdates = updateDto.odsApiDiscoveryUrl || updateDto.adminApiUrl;
```

Replace the tenant-mode lock block:

```typescript
      // Validate that tenant mode changes are not attempted (security check)
      if (updateDto.isMultitenant !== undefined) {
        const expectedTenantMode = existingStrategy ? existingStrategy.getTenantModeDefault(existingEnvironment) : false;

        if (updateDto.isMultitenant !== expectedTenantMode) {
          const currentMode = expectedTenantMode ? 'multi-tenant' : 'single-tenant';
          const attemptedMode = updateDto.isMultitenant ? 'multi-tenant' : 'single-tenant';
          const versionInfo = !existingStrategy?.supportsMultiTenant
            ? ' (tenant mode not applicable for this environment type)'
            : '';
          throw new ValidationHttpException({
            field: 'isMultitenant',
            message: `Tenant mode cannot be changed after creation. Current mode: ${currentMode}, attempted: ${attemptedMode}${versionInfo}`,
          });
        }
      }
```

Replace the v1-only credential-recreation guard (keeps using the strategy's own
`version` tag, since this behavior is genuinely v1-specific and stays inline per the
design):

```typescript
      // Handle credential recreation for v1 environments when Admin API URL changes
      if (hasUrlUpdates && updateDto.adminApiUrl && existingStrategy?.version === 'v1') {
        this.logger.log('Admin API URL changed for v1 environment - recreating credentials');

        const { clientId, clientSecret } = await this.createClientCredentials({
          adminApiUrl: updateDto.adminApiUrl,
          isMultitenant: false,
          version: 'v1'
        } as PostSbEnvironmentDto);

        const credentials = {
          ClientId: clientId,
          ClientSecret: clientSecret,
          url: updateDto.adminApiUrl,
        };

        await this.startingBlocksServiceV1.saveAdminApiCredentials(existingEnvironment, credentials);
        this.logger.log('V1 credentials recreated successfully');
      }
```

Replace the ODS URL `configPublic.values` patch block (design gap #2's update-time
counterpart):

```typescript
      // Update URL and configuration fields if provided
      if (updateDto.odsApiDiscoveryUrl !== undefined && existingStrategy) {
        updatedProperties.configPublic = {
          ...existingEnvironment.configPublic,
          values: existingStrategy.applyOdsUrlUpdate(existingEnvironment.configPublic, updateDto.odsApiDiscoveryUrl),
        };
      }
```

Replace the admin API URL / credential-clearing block's version check:

```typescript
      if (updateDto.adminApiUrl !== undefined) {
        updatedProperties.configPublic = {
          ...updatedProperties.configPublic || existingEnvironment.configPublic,
          adminApiUrl: updateDto.adminApiUrl,
        };

        // When the Admin API URL changes on a v2/v3 environment, the stored credentials
        // are invalid for the new endpoint. Clear them so the pg_boss job's bootstrap
        // logic re-registers fresh credentials against the new URL.
        const adminApiUrlChanged = updateDto.adminApiUrl !== existingEnvironment.adminApiUrl;
        if (existingStrategy?.supportsMultiTenant && adminApiUrlChanged) {
          this.logger.log(
            `Admin API URL changed for ${existingStrategy.version} environment ${id} — clearing tenant credentials for re-bootstrap`
          );
          if (updatedProperties.configPublic?.values) {
            (updatedProperties.configPublic.values as ISbEnvironmentConfigPublicV2).tenants = {};
          }
          updatedProperties.configPrivate = { tenants: {} };
        }
      }
```

Replace the re-sync trigger block:

```typescript
      const updatedEnvironment = await this.sbEnvironmentsRepository.save(updatedProperties);
      let syncQueue;

      // Delegate tenant/ODS/EdOrg sync to the background job — but only when fields that
      // affect the sync result actually changed. Name-only edits don't require a re-sync
      // and would add unnecessary latency.
      const resyncTriggered = existingStrategy?.shouldTriggerResync(!!hasUrlUpdates) ?? false;
      if (resyncTriggered && existingStrategy) {
        const dispatchResult = await existingStrategy.dispatchSync(updatedEnvironment);
        if (dispatchResult.kind === 'queued') {
          syncQueue = toSbSyncQueueDto(dispatchResult.syncQueue);
        }
        this.logger.log(`Triggered ${existingStrategy.version} sync job for environment ID ${updatedEnvironment.id} after update`);
      } else if (updateDto.tenants && Array.isArray(updateDto.tenants)) {
        await this.updateEnvironmentTenants(updatedEnvironment, updateDto.tenants);
      }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `nx test api --testPathPattern=sb-environments-edfi.services.spec.ts`
Expected: PASS

- [ ] **Step 5: Run the full test suite to confirm no v1/v2 regressions**

Run: `nx test api`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/sb-environments-global/sb-environments-edfi.services.ts packages/api/src/sb-environments-global/sb-environments-edfi.services.spec.ts
git commit -m "feat(AC-526): wire SbEnvironmentsEdFiService.updateEnvironment() to AdminApiVersionStrategyFactory"
```

Next: [526-plan-06-wire-sync.md](./526-plan-06-wire-sync.md).
