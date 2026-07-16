# Phase 4: Wire the factory into `SbEnvironmentsEdFiService.create()`

> Part of the AC-526 implementation plan — see
> [526-plan-00-overview.md](./526-plan-00-overview.md) for goal, architecture, and global
> constraints. Previous phase:
> [526-plan-03-strategy-v3-and-factory.md](./526-plan-03-strategy-v3-and-factory.md).
> Next phase: [526-plan-05-wire-update.md](./526-plan-05-wire-update.md).

## Task 5: Wire the factory into `SbEnvironmentsEdFiService.create()`

**Files:**
- Modify: `packages/api/src/sb-environments-global/sb-environments-edfi.services.ts`
- Test: `packages/api/src/sb-environments-global/sb-environments-edfi.services.spec.ts`
  (create if it does not already exist; check first — grep found no existing spec file
  for this service, so create one covering `create()` for v1/v2/v3.)

**Interfaces:**
- Consumes: `AdminApiVersionStrategyFactory` (Phase 3).

- [ ] **Step 1: Check whether a spec file already exists**

Run: `ls packages/api/src/sb-environments-global/sb-environments-edfi.services.spec.ts`

If it exists, read it fully before proceeding and extend it (do not overwrite existing
cases). If it does not exist, create it fresh with the content below.

- [ ] **Step 2: Write the failing test(s) for v3 create support**

```typescript
// packages/api/src/sb-environments-global/sb-environments-edfi.services.spec.ts
import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getEntityManagerToken } from '@nestjs/typeorm';
import { SbEnvironmentsEdFiService } from './sb-environments-edfi.services';
import { AdminApiVersionStrategyFactory } from '../admin-api-version-strategy';
import { EdfiTenant, SbEnvironment, SbSyncQueue } from '@edanalytics/models-server';
import { StartingBlocksServiceV1, StartingBlocksServiceV2 } from '../teams/edfi-tenants/starting-blocks';
import * as utils from '../utils';

jest.mock('../utils', () => ({
  ...jest.requireActual('../utils'),
  validateAdminApiUrl: jest.fn(),
  fetchOdsApiMetadata: jest.fn(),
}));

describe('SbEnvironmentsEdFiService.create (v3)', () => {
  let service: SbEnvironmentsEdFiService;
  let sbEnvironmentsRepository: { save: jest.Mock; create: jest.Mock };
  let strategyFactory: { getStrategy: jest.Mock };
  let v3Strategy: {
    version: string;
    buildConfigPublic: jest.Mock;
    getRegistrationHeaders: jest.Mock;
    dispatchSync: jest.Mock;
  };

  beforeEach(async () => {
    v3Strategy = {
      version: 'v3',
      buildConfigPublic: jest.fn().mockReturnValue({
        version: 'v3',
        values: { meta: { mode: 'SingleTenant' }, adminApiUuid: 'uuid-1' },
        adminApiUrl: 'https://api.test.com',
      }),
      getRegistrationHeaders: jest.fn().mockReturnValue({ 'Content-Type': 'application/x-www-form-urlencoded' }),
      dispatchSync: jest.fn().mockResolvedValue({ kind: 'queued', syncQueue: { id: 'job-1', state: 'completed' } }),
    };
    strategyFactory = { getStrategy: jest.fn().mockReturnValue(v3Strategy) };

    sbEnvironmentsRepository = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ id: 99, ...v })),
    };

    (utils.validateAdminApiUrl as jest.Mock).mockResolvedValue({ specificationVersion: 'v3' });
    (utils.fetchOdsApiMetadata as jest.Mock).mockResolvedValue({ version: '5.3' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SbEnvironmentsEdFiService,
        { provide: getRepositoryToken(SbEnvironment), useValue: sbEnvironmentsRepository },
        { provide: StartingBlocksServiceV1, useValue: {} },
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

  it('creates a v3 environment, builds a v3-shaped configPublic via the strategy, and returns a syncQueue', async () => {
    const result = await service.create(
      {
        name: 'my-v3-env',
        environmentLabel: 'my-v3-env',
        adminApiUrl: 'https://api.test.com',
        odsApiDiscoveryUrl: 'https://ods.test.com',
        startingBlocks: false,
      } as any,
      undefined
    );

    expect(strategyFactory.getStrategy).toHaveBeenCalledWith('v3');
    expect(v3Strategy.buildConfigPublic).toHaveBeenCalled();
    expect(v3Strategy.dispatchSync).toHaveBeenCalled();
    expect((result as any).syncQueue).toBeDefined();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `nx test api --testPathPattern=sb-environments-edfi.services.spec.ts`
Expected: FAIL — current `create()` still branches on `version === 'v1'/'v2'` string
checks and never calls `strategyFactory.getStrategy`.

- [ ] **Step 4: Refactor `create()` to use the strategy factory**

In `packages/api/src/sb-environments-global/sb-environments-edfi.services.ts`:

Add the constructor dependency (replace the existing constructor block):

```typescript
  constructor(
    @InjectRepository(SbEnvironment)
    private sbEnvironmentsRepository: Repository<SbEnvironment>,
    private readonly startingBlocksServiceV1: StartingBlocksServiceV1,
    private readonly startingBlocksServiceV2: StartingBlocksServiceV2,
    @InjectRepository(EdfiTenant)
    private edfiTenantsRepository: Repository<EdfiTenant>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    @Inject('IJobQueueService')
    private readonly jobQueue: IJobQueueService,
    @InjectRepository(SbSyncQueue)
    private readonly queueRepository: Repository<SbSyncQueue>,
    private readonly strategyFactory: AdminApiVersionStrategyFactory
  ) {}
```

Add the import at the top of the file:

```typescript
import { AdminApiVersionStrategyFactory } from '../admin-api-version-strategy';
```

Replace the `configPublic` ternary (design gap #2) and the version-check block after it
(design gap #1) inside `create()`:

```typescript
        // Build configPublic based on detected version
        const strategy = this.strategyFactory.getStrategy(createSbEnvironmentDto.version);
        const configPublic = strategy.buildConfigPublic({
          createSbEnvironmentDto,
          odsApiMetaResponse,
          tenantMode,
        });
        Logger.log(
          `Auto-detected API version: ${detectedVersion} from ODS version: ${odsApiMetaResponse.version}`
        );
        const sbEnvironment = await this.sbEnvironmentsRepository.save(
          addUserCreating(
            this.sbEnvironmentsRepository.create({
              name: createSbEnvironmentDto.name,
              envLabel: createSbEnvironmentDto.environmentLabel, //this field is for the lambda function
              configPublic: configPublic,
            } as SbEnvironment),
            user
          )
        );

        const dispatchResult = await strategy.dispatchSync(sbEnvironment, createSbEnvironmentDto);
        if (dispatchResult.kind === 'queued') {
          return { ...sbEnvironment, syncQueue: toSbSyncQueueDto(dispatchResult.syncQueue) };
        }
        return sbEnvironment;
```

Delete the now-unused private methods `syncv1Environment`, `syncv2Environment`,
`findOrCreateTenant`, `syncTenantDataV1`, `createODSObjectV1`, `saveSyncableOdsV1` (moved
to `V1AdminApiVersionStrategy` / `V2AdminApiVersionStrategy` in Phases 1–2). Keep
`createODSObject` and `saveSyncableOds` (still used by `updateEnvironmentTenants()` /
`createNewTenant()` / `updateExistingTenant()` — not part of this refactor's scope).

Update `createClientCredentials()` to build headers via the strategy instead of the
inline `=== 'v2'` check (design gap #6):

```typescript
  private async createClientCredentials(
    createSbEnvironmentDto: PostSbEnvironmentDto,
    tenant?: string
  ): Promise<TenantCredentials> {
    const registerUrl = `${createSbEnvironmentDto.adminApiUrl}/connect/register`;
    const secretCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const secretBytes = randomBytes(32);
    const clientSecret = Array.from(secretBytes, (byte) => secretCharset[byte % secretCharset.length]).join('');
    const clientId = `client_${randomUUID()}`;
    const nameSuffixBytes = randomBytes(4);
    const displayNameSuffix = Array.from(nameSuffixBytes, (byte) =>
      (byte % 36).toString(36)
    ).join('');
    const displayName = `AdminApp-v4-${displayNameSuffix}`;
    const formData = new URLSearchParams();
    formData.append('ClientId', clientId);
    formData.append('ClientSecret', clientSecret);
    formData.append('DisplayName', displayName);

    const strategy = this.strategyFactory.getStrategy(createSbEnvironmentDto.version);
    const headers = strategy.getRegistrationHeaders(!!createSbEnvironmentDto.isMultitenant, tenant);

    try {
      const registerResponse = await axios.post(registerUrl, formData.toString(), {
        headers: headers,
      });

      if (!registerResponse.status || registerResponse.status !== 200) {
        throw new Error(`Registration failed! status: ${registerResponse.status}`);
      }
      return { clientId, displayName, clientSecret };
    } catch (error) {
      this.logger.error('Failed to register client credentials:', error);

      // A tenant header means this is a multi-tenant registration; a 400 there almost
      // always means the tenant name doesn't exist/isn't configured.
      if (headers.tenant && error.response?.status === 400) {
        throw new ValidationHttpException({
          field: 'tenants',
          message: `Tenant '${tenant}' does not exist or is not properly configured in the Admin API`,
        });
      }

      throw new ValidationHttpException({
        field: 'adminApiUrl',
        message: error.message,
      });
    }
  }
```

Note: this method is currently only reachable from the (now-deleted) `syncv1Environment`
in this file. Confirm with a repo-wide grep whether it is still referenced anywhere else
in this file (e.g. the v1 credential-recreation branch in `updateEnvironment()`, handled
in Phase 5) before deleting it — if `updateEnvironment()` is the only remaining caller,
keep the method; otherwise delete it as dead code once Phase 5 also moves off it.

- [ ] **Step 5: Run the test to verify it passes**

Run: `nx test api --testPathPattern=sb-environments-edfi.services.spec.ts`
Expected: PASS

- [ ] **Step 6: Run the full test suite to confirm no v1/v2 regressions**

Run: `nx test api`
Expected: PASS — all pre-existing tests referencing `create()` continue to pass
unmodified in their assertions (only DI wiring for the new `strategyFactory` mock may
need adding to any pre-existing spec's `TestingModule`, per the Testing section of the
design doc).

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/sb-environments-global/sb-environments-edfi.services.ts packages/api/src/sb-environments-global/sb-environments-edfi.services.spec.ts
git commit -m "feat(AC-526): wire SbEnvironmentsEdFiService.create() to AdminApiVersionStrategyFactory"
```

Next: [526-plan-05-wire-update.md](./526-plan-05-wire-update.md).
