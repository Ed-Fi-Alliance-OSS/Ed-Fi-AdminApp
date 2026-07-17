# Async ODS Create Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make non-StartingBlocks ODS creation persist a local ODS row (`PendingCreate`), enqueue environment sync, and redirect the UI to the ODS list page.

**Architecture:** Keep a single non-SB create call from `CreateOdsPage` to Admin API v2 `postDbInstance`. Extend backend orchestration in `AdminApiControllerV2.postDbInstance` to save the local ODS row and enqueue `ENV_SYNC_CHNL` after Admin API accepts the async request. Preserve existing validation/error mapping and change FE success navigation to the parent ODS list.

**Tech Stack:** NestJS, TypeORM, PgBoss job queue abstraction (`IJobQueueService`), React, React Hook Form, TanStack Query, Jest (API + FE), Nx.

---

## File Structure and Responsibilities

- **Modify:** `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.ts`
  - Add orchestration after `sbService.postDbInstance`: local ODS insert + queue enqueue.
  - Keep validation mapping behavior unchanged.
- **Modify:** `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts`
  - Update constructor mocks for new controller dependency.
  - Add coverage for local ODS row creation + `ENV_SYNC_CHNL` enqueue.
- **Modify:** `packages/fe/src/app/Pages/Ods/CreateOdsPage.tsx`
  - Keep SB flow unchanged.
  - For non-SB success, navigate to parent list path instead of ODS details.
- **Modify:** `packages/fe/src/app/Pages/Ods/CreateOdsPage.spec.tsx`
  - Assert non-SB success redirects to `/parent`.
  - Preserve existing mutation-path assertions.

### Task 1: Write backend failing tests for postDbInstance orchestration

**Files:**
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts`
- Test: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts`

- [ ] **Step 1: Add failing test for local ODS insert + sync enqueue**

```ts
it('creates local ODS row with PendingCreate and enqueues ENV sync after dbInstance creation', async () => {
  mockSbService.postDbInstance.mockResolvedValue({ id: 777 });
  mockOdsRepository.save.mockResolvedValue({ id: 901 });
  mockJobQueue.send.mockResolvedValue('job-123');

  await expect(controller.postDbInstance(1, 1, mockEdfiTenant, mockDbInstance)).resolves.toEqual({
    id: 901,
  });

  expect(mockOdsRepository.save).toHaveBeenCalledWith({
    edfiTenantId: mockEdfiTenant.id,
    sbEnvironmentId: mockEdfiTenant.sbEnvironmentId,
    odsInstanceId: 777,
    dbName: mockDbInstance.name,
    odsInstanceName: mockDbInstance.name,
    databaseTemplate: mockDbInstance.databaseTemplate,
    status: 'PendingCreate',
  });
  expect(mockJobQueue.send).toHaveBeenCalledWith(
    ENV_SYNC_CHNL,
    { sbEnvironmentId: mockEdfiTenant.sbEnvironmentId },
    { expireInHours: 2 }
  );
});
```

- [ ] **Step 2: Update test setup mocks to support the new constructor dependency and repository usage**

```ts
let mockOdsRepository: { save: jest.Mock };
let mockJobQueue: { send: jest.Mock };

beforeEach(() => {
  mockSbService = { postDbInstance: jest.fn() };
  mockOdsRepository = { save: jest.fn() };
  mockJobQueue = { send: jest.fn() };
  controller = new AdminApiControllerV2(
    null as any,
    mockSbService as any,
    null as any,
    mockOdsRepository as any,
    mockJobQueue as any
  );
});
```

- [ ] **Step 3: Run API spec to confirm failure before implementation**

Run:

```bash
npx jest packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts --config packages/api/jest.config.ts
```

Expected: FAIL because controller does not yet save ODS / enqueue sync.

- [ ] **Step 4: Commit test-only changes**

```bash
git add packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts
git commit -m "test: cover dbinstance async create orchestration"
```

### Task 2: Implement backend orchestration and make API tests pass

**Files:**
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.ts`
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts`
- Test: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts`

- [ ] **Step 1: Add imports/dependency injection for queue service and channel**

```ts
import { Inject } from '@nestjs/common';
import { ENV_SYNC_CHNL } from '../../../../sb-sync/sb-sync.module';
import { IJobQueueService } from '../../../../sb-sync/job-queue/job-queue.interface';
```

Constructor update:

```ts
constructor(
  private readonly integrationAppsTeamService: IntegrationAppsTeamService,
  private readonly sbService: AdminApiServiceV2,
  @InjectRepository(Edorg) private readonly edorgRepository: Repository<Edorg>,
  @InjectRepository(Ods) private readonly odsRepository: Repository<Ods>,
  @Inject('IJobQueueService') private readonly jobQueue: IJobQueueService
) {}
```

- [ ] **Step 2: Extend `postDbInstance` to persist local row + enqueue sync**

```ts
const createdDbInstance = await this.sbService.postDbInstance(edfiTenant, dbInstance);

const createdOds = await this.odsRepository.save({
  edfiTenantId: edfiTenant.id,
  sbEnvironmentId: edfiTenant.sbEnvironmentId,
  odsInstanceId: createdDbInstance.id,
  dbName: dbInstance.name,
  odsInstanceName: dbInstance.name,
  databaseTemplate: dbInstance.databaseTemplate,
  status: 'PendingCreate',
});

await this.jobQueue.send(
  ENV_SYNC_CHNL,
  { sbEnvironmentId: edfiTenant.sbEnvironmentId },
  { expireInHours: 2 }
);

return { id: createdOds.id };
```

Place this inside existing `try` so current validation/error mapping in `catch` remains intact.

- [ ] **Step 3: Run API spec to verify pass**

Run:

```bash
npx jest packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts --config packages/api/jest.config.ts
```

Expected: PASS with new orchestration assertion and existing validation assertions still green.

- [ ] **Step 4: Commit backend implementation**

```bash
git add packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.ts packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts
git commit -m "fix: persist local ods and enqueue sync after dbinstance create"
```

### Task 3: Update CreateOdsPage non-SB success navigation and verify FE tests

**Files:**
- Modify: `packages/fe/src/app/Pages/Ods/CreateOdsPage.tsx`
- Modify: `packages/fe/src/app/Pages/Ods/CreateOdsPage.spec.tsx`
- Test: `packages/fe/src/app/Pages/Ods/CreateOdsPage.spec.tsx`

- [ ] **Step 1: Write failing FE expectation for non-SB redirect target**

Update test assertion:

```ts
expect(navSpy).toHaveBeenCalledWith('/parent');
```

Keep existing assertions that `dbInstancesMutateAsync` is called and `odsMutateAsync` is not.

- [ ] **Step 2: Run FE spec to confirm failure**

Run:

```bash
npx jest packages/fe/src/app/Pages/Ods/CreateOdsPage.spec.tsx --config packages/fe/jest.config.ts
```

Expected: FAIL because component still redirects to detail page.

- [ ] **Step 3: Implement non-SB success redirect to list page**

Update callback wiring in `CreateOdsPage.tsx`:

```ts
const callbacks = {
  ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
  onSuccess: () => {
    navigate(parentPath);
  },
};

if (isStartingBlocks) {
  const sbCallbacks = {
    ...callbacks,
    onSuccess: (result: { id: number | string }) => goToView(result.id),
  };
  return postOds.mutateAsync({ entity: data }, sbCallbacks).catch(noop);
}
return postDbInstance
  .mutateAsync(
    { entity: { name: data.name, databaseTemplate: data.databaseTemplate! } },
    callbacks
  )
  .catch(noop);
```

- [ ] **Step 4: Run FE spec to verify pass**

Run:

```bash
npx jest packages/fe/src/app/Pages/Ods/CreateOdsPage.spec.tsx --config packages/fe/jest.config.ts
```

Expected: PASS with new non-SB redirect behavior and unchanged SB behavior.

- [ ] **Step 5: Commit FE changes**

```bash
git add packages/fe/src/app/Pages/Ods/CreateOdsPage.tsx packages/fe/src/app/Pages/Ods/CreateOdsPage.spec.tsx
git commit -m "fix: redirect non-sb ods create to list page"
```

### Task 4: Final integrated validation and build

**Files:**
- Modify: none
- Test: previously modified test files + full build

- [ ] **Step 1: Run focused API and FE tests together**

```bash
npx jest packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts --config packages/api/jest.config.ts && npx jest packages/fe/src/app/Pages/Ods/CreateOdsPage.spec.tsx --config packages/fe/jest.config.ts
```

Expected: both test commands PASS.

- [ ] **Step 2: Run required full build**

```bash
npm run build
```

Expected: `build:fe` and `build:api` complete successfully.

- [ ] **Step 3: Commit verification checkpoint**

```bash
git add packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.ts packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts packages/fe/src/app/Pages/Ods/CreateOdsPage.tsx packages/fe/src/app/Pages/Ods/CreateOdsPage.spec.tsx
git commit -m "fix: complete async ods create persistence and list redirect"
```
