# ODS Non-StartingBlocks Async Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement non-StartingBlocks ODS deletion via async `dbinstances` flow using `dbInstanceId`, with local status set to `PendingDelete` and environment sync queued.

**Architecture:** Add a new Admin API v2 delete endpoint keyed by `dbInstanceId` that updates the local ODS row and triggers sync, mirroring the current async create pattern. Extend FE query builder support for `dbInstancesV2.delete`, then route delete actions in ODS list/detail to use db-instance delete only for non-StartingBlocks and only when `dbInstanceId > 0`. Preserve existing StartingBlocks delete behavior.

**Tech Stack:** NestJS controller/service, TypeORM repository, React + TanStack Query, EntityQueryBuilder, Jest

---

## File Structure and Responsibilities

- `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.ts`  
  Admin API client wrapper; add `deleteDbInstance(edfiTenant, dbInstanceId)`.
- `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts`  
  Service contract tests for new delete method.
- `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.ts`  
  Add endpoint `DELETE dbinstances/:dbInstanceId`; set local status, call service delete, enqueue sync.
- `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts`  
  Controller behavior tests for new delete endpoint.
- `packages/fe/src/app/api/queries/queries.v7.ts`  
  Add `dbInstancesV2.delete`.
- `packages/fe/src/app/Pages/Ods/useOdsActions.tsx`  
  Detail-page delete action routing (StartingBlocks vs non-StartingBlocks).
- `packages/fe/src/app/Pages/Ods/OdssPage.tsx`  
  List-page row delete action routing and eligibility by `dbInstanceId > 0`.
- `packages/fe/src/app/Pages/Ods/useOdsActions.spec.tsx` (new)  
  Tests for delete action selection + eligibility rules.
- `packages/fe/src/app/Pages/Ods/OdssPage.spec.tsx`  
  Add tests covering list-row delete action availability and mutation target.

### Task 1: Add failing backend tests for async db-instance delete

**Files:**
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts`
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts`
- Test: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts`
- Test: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts`

- [ ] **Step 1: Write failing service tests for `deleteDbInstance`**

```ts
describe('deleteDbInstance', () => {
  it('calls admin API DELETE dbInstances/:id and resolves undefined', async () => {
    const mockDelete = jest.fn().mockResolvedValue(undefined);
    const getAdminApiClientSpy = jest
      .spyOn(service as any, 'getAdminApiClient')
      .mockReturnValue({ delete: mockDelete });

    await expect(service.deleteDbInstance({ id: 1 } as any, 321)).resolves.toBeUndefined();

    expect(getAdminApiClientSpy).toHaveBeenCalledWith({ id: 1 }, true);
    expect(mockDelete).toHaveBeenCalledWith('dbInstances/321');
  });

  it('rethrows when admin API delete fails', async () => {
    const expectedError = new Error('failed to delete');
    const mockDelete = jest.fn().mockRejectedValue(expectedError);
    jest.spyOn(service as any, 'getAdminApiClient').mockReturnValue({ delete: mockDelete });

    await expect(service.deleteDbInstance({ id: 1 } as any, 321)).rejects.toThrow('failed to delete');
  });
});
```

- [ ] **Step 2: Write failing controller tests for new `DELETE dbinstances/:dbInstanceId`**

```ts
describe('AdminApiControllerV2 - deleteDbInstance', () => {
  let controller: AdminApiControllerV2;
  let mockSbService: { deleteDbInstance: jest.Mock };
  let mockOdsRepository: { findOneBy: jest.Mock; save: jest.Mock };
  let mockJobQueue: { send: jest.Mock };

  const mockTenant: any = { id: 1, sbEnvironmentId: 7 };
  const mockOds: any = { id: 12, edfiTenantId: 1, dbInstanceId: 321, status: 'Active' };

  beforeEach(() => {
    mockSbService = { deleteDbInstance: jest.fn() };
    mockOdsRepository = { findOneBy: jest.fn(), save: jest.fn() };
    mockJobQueue = { send: jest.fn() };
    controller = new AdminApiControllerV2(
      null as any,
      mockSbService as any,
      null as any,
      mockOdsRepository as any,
      mockJobQueue as any
    );
  });

  it('sets PendingDelete, calls admin delete, and enqueues sync', async () => {
    mockOdsRepository.findOneBy.mockResolvedValue(mockOds);
    mockOdsRepository.save.mockResolvedValue({ ...mockOds, status: 'PendingDelete' });
    mockSbService.deleteDbInstance.mockResolvedValue(undefined);
    mockJobQueue.send.mockResolvedValue('job-1');

    await expect(controller.deleteDbInstance(321, 1, 1, mockTenant)).resolves.toBeUndefined();
    expect(mockOdsRepository.save).toHaveBeenCalledWith({ ...mockOds, status: 'PendingDelete' });
    expect(mockSbService.deleteDbInstance).toHaveBeenCalledWith(mockTenant, 321);
    expect(mockJobQueue.send).toHaveBeenCalledWith(
      ENV_SYNC_CHNL,
      { sbEnvironmentId: mockTenant.sbEnvironmentId },
      { expireInHours: 2 }
    );
  });
});
```

- [ ] **Step 3: Run backend tests to verify failure**

Run:
```bash
npx jest --config packages/api/jest.config.ts --runTestsByPath packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts
```

Expected: FAIL with missing method/endpoint behavior (`deleteDbInstance` not implemented yet).

- [ ] **Step 4: Commit failing tests checkpoint**

```bash
git add packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts
git commit -m "test: add failing async dbinstance delete coverage" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 2: Implement backend async delete endpoint and service method

**Files:**
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.ts`
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.ts`
- Test: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts`
- Test: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts`

- [ ] **Step 1: Implement `deleteDbInstance` in service**

```ts
async deleteDbInstance(edfiTenant: EdfiTenant, dbInstanceId: number) {
  await this.getAdminApiClient(edfiTenant, true)
    .delete(`dbInstances/${dbInstanceId}`)
    .catch((err) => {
      this.logger.error(
        `Error deleting dbInstance ${dbInstanceId} for tenant ${edfiTenant.id}: ${err}`
      );
      throw err;
    });
  return undefined;
}
```

- [ ] **Step 2: Implement controller endpoint**

```ts
@Delete('dbinstances/:dbInstanceId')
@Authorize({
  privilege: 'team.sb-environment.edfi-tenant:delete-ods',
  subject: {
    id: '__filtered__',
    edfiTenantId: 'edfiTenantId',
    teamId: 'teamId',
  },
})
async deleteDbInstance(
  @Param('dbInstanceId', new ParseIntPipe()) dbInstanceId: number,
  @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
  @Param('teamId', new ParseIntPipe()) teamId: number,
  @ReqEdfiTenant() edfiTenant: EdfiTenant
) {
  if (dbInstanceId <= 0) {
    throw new BadRequestException('dbInstanceId must be greater than zero');
  }

  const ods = await this.odsRepository.findOneBy({
    edfiTenantId: edfiTenant.id,
    dbInstanceId,
  });
  if (!ods) {
    throw new NotFoundException('ODS not found for dbInstanceId');
  }

  await this.odsRepository.save({ ...ods, status: 'PendingDelete' });
  await this.sbService.deleteDbInstance(edfiTenant, dbInstanceId);
  await this.jobQueue.send(
    ENV_SYNC_CHNL,
    { sbEnvironmentId: edfiTenant.sbEnvironmentId },
    { expireInHours: 2 }
  );
}
```

- [ ] **Step 3: Add two more controller tests (invalid id and not found)**

```ts
it('throws BadRequestException when dbInstanceId <= 0', async () => {
  await expect(controller.deleteDbInstance(0, 1, 1, mockTenant)).rejects.toThrow(
    new BadRequestException('dbInstanceId must be greater than zero')
  );
});

it('throws NotFoundException when local ODS does not exist', async () => {
  mockOdsRepository.findOneBy.mockResolvedValue(null);
  await expect(controller.deleteDbInstance(321, 1, 1, mockTenant)).rejects.toThrow(
    new NotFoundException('ODS not found for dbInstanceId')
  );
});
```

- [ ] **Step 4: Run backend tests to verify pass**

Run:
```bash
npx jest --config packages/api/jest.config.ts --runTestsByPath packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit backend implementation**

```bash
git add packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.ts packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.ts packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts
git commit -m "feat: add async dbinstance delete endpoint for non-startingblocks ods" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 3: Add FE query + failing action tests for routing and eligibility

**Files:**
- Modify: `packages/fe/src/app/api/queries/queries.v7.ts`
- Create: `packages/fe/src/app/Pages/Ods/useOdsActions.spec.tsx`
- Modify: `packages/fe/src/app/Pages/Ods/OdssPage.spec.tsx`
- Test: `packages/fe/src/app/Pages/Ods/useOdsActions.spec.tsx`
- Test: `packages/fe/src/app/Pages/Ods/OdssPage.spec.tsx`

- [ ] **Step 1: Add failing FE tests for non-StartingBlocks delete behavior**

```ts
// useOdsActions.spec.tsx
it('uses dbInstancesV2.delete for non-startingBlocks with dbInstanceId > 0', async () => {
  mockUseNavContext.mockReturnValue({
    edfiTenantId: 3,
    edfiTenant: { id: 3, sbEnvironmentId: 2 },
    sbEnvironmentId: 2,
    sbEnvironment: { startingBlocks: false },
    teamId: 1,
  });
  mockUseAuthorize.mockReturnValue(true);
  mockUseParams.mockReturnValue({ odsId: '10' });

  const mutateAsync = jest.fn().mockResolvedValue(undefined);
  (dbInstancesV2.delete as jest.Mock).mockReturnValue({ isPending: false, mutateAsync });
  (odsQueries.delete as jest.Mock).mockReturnValue({ isPending: false, mutateAsync: jest.fn() });

  const actions = useOdsActions({ id: 10, dbInstanceId: 321 } as any);
  await actions.Delete.onClick();

  expect(dbInstancesV2.delete).toHaveBeenCalled();
  expect(mutateAsync).toHaveBeenCalledWith(
    { id: 321 },
    expect.objectContaining({ onSuccess: expect.any(Function) })
  );
});
```

```ts
it('omits Delete for non-startingBlocks when dbInstanceId is null', () => {
  mockUseNavContext.mockReturnValue({
    edfiTenantId: 3,
    edfiTenant: { id: 3, sbEnvironmentId: 2 },
    sbEnvironmentId: 2,
    sbEnvironment: { startingBlocks: false },
    teamId: 1,
  });
  mockUseAuthorize.mockReturnValue(true);
  mockUseParams.mockReturnValue({});
  const actions = useOdsActions({ id: 10, dbInstanceId: null } as any);
  expect(actions.Delete).toBeUndefined();
});
```

- [ ] **Step 2: Add failing FE test for StartingBlocks fallback**

```ts
it('uses odsQueries.delete for startingBlocks', async () => {
  mockUseNavContext.mockReturnValue({
    edfiTenantId: 3,
    edfiTenant: { id: 3, sbEnvironmentId: 2 },
    sbEnvironmentId: 2,
    sbEnvironment: { startingBlocks: true },
    teamId: 1,
  });
  mockUseAuthorize.mockReturnValue(true);
  mockUseParams.mockReturnValue({});

  const odsDelete = jest.fn().mockResolvedValue(undefined);
  (odsQueries.delete as jest.Mock).mockReturnValue({ isPending: false, mutateAsync: odsDelete });
  (dbInstancesV2.delete as jest.Mock).mockReturnValue({ isPending: false, mutateAsync: jest.fn() });

  const actions = useOdsActions({ id: 10, dbInstanceId: 321 } as any);
  await actions.Delete.onClick();
  expect(odsDelete).toHaveBeenCalledWith(
    { id: 10 },
    expect.objectContaining({ onSuccess: expect.any(Function) })
  );
});
```

- [ ] **Step 3: Run FE tests to verify failure before implementation**

Run:
```bash
npx jest --config packages/fe/jest.config.ts --runTestsByPath packages/fe/src/app/Pages/Ods/useOdsActions.spec.tsx packages/fe/src/app/Pages/Ods/OdssPage.spec.tsx
```

Expected: FAIL because `dbInstancesV2.delete` flow and eligibility logic are not implemented yet.

- [ ] **Step 4: Commit failing FE tests checkpoint**

```bash
git add packages/fe/src/app/Pages/Ods/useOdsActions.spec.tsx packages/fe/src/app/Pages/Ods/OdssPage.spec.tsx
git commit -m "test: add failing ods delete routing and eligibility coverage" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 4: Implement FE delete routing and finish verification

**Files:**
- Modify: `packages/fe/src/app/api/queries/queries.v7.ts`
- Modify: `packages/fe/src/app/Pages/Ods/useOdsActions.tsx`
- Modify: `packages/fe/src/app/Pages/Ods/OdssPage.tsx`
- Test: `packages/fe/src/app/Pages/Ods/useOdsActions.spec.tsx`
- Test: `packages/fe/src/app/Pages/Ods/OdssPage.spec.tsx`

- [ ] **Step 1: Implement query + action routing**

```ts
// queries.v7.ts
export const dbInstancesV2 = new EntityQueryBuilder({
  adminApi: true,
  name: 'Dbinstance',
  includeEdfiTenant: true,
  includeTeam: TeamOptions.Required,
})
  .post('post', { ResDto: Id, ReqDto: PostDbInstanceDtoV2 })
  .delete('delete')
  .build();
```

```ts
// useOdsActions.tsx (core decision logic)
const deleteOds = odsQueries.delete({ edfiTenant, teamId });
const deleteDbInstance = dbInstancesV2.delete({ edfiTenant, teamId });
const canDeleteDbInstance =
  !sbEnvironment.startingBlocks &&
  ods.dbInstanceId !== null &&
  ods.dbInstanceId > 0;

onClick: () =>
  canDeleteDbInstance
    ? deleteDbInstance.mutateAsync(
        { id: ods.dbInstanceId },
        {
          ...mutationErrCallback({ popGlobalBanner: popBanner }),
          onSuccess: () =>
            odsId &&
            navigate(`/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/odss`),
        }
      )
    : deleteOds.mutateAsync(
        { id: ods.id },
        {
          ...mutationErrCallback({ popGlobalBanner: popBanner }),
          onSuccess: () =>
            odsId &&
            navigate(`/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/odss`),
        }
      )
```

```ts
// OdssPage.tsx row action decision
Delete: canDeleteDbInstance
  ? {
      icon: Icons.Delete,
      text: 'Delete',
      title: 'Delete ODS',
      confirmBody: 'This will permanently delete the ODS.',
      confirm: true,
      onClick: () =>
        deleteDbInstance.mutateAsync(
          { id: ods.dbInstanceId! },
          { ...mutationErrCallback({ popGlobalBanner: popBanner }) }
        ),
    }
  : undefined
```

- [ ] **Step 2: Run FE tests to verify pass**

Run:
```bash
npx jest --config packages/fe/jest.config.ts --runTestsByPath packages/fe/src/app/Pages/Ods/useOdsActions.spec.tsx packages/fe/src/app/Pages/Ods/OdssPage.spec.tsx
```

Expected: PASS.

- [ ] **Step 3: Run focused backend+frontend suite for this feature**

Run:
```bash
npx jest --config packages/api/jest.config.ts --runTestsByPath packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts
npx jest --config packages/fe/jest.config.ts --runTestsByPath packages/fe/src/app/Pages/Ods/useOdsActions.spec.tsx packages/fe/src/app/Pages/Ods/OdssPage.spec.tsx packages/fe/src/app/Pages/Ods/CreateOdsPage.spec.tsx
npm run build
```

Expected: all pass, build succeeds.

- [ ] **Step 4: Commit implementation**

```bash
git add packages/fe/src/app/api/queries/queries.v7.ts packages/fe/src/app/Pages/Ods/useOdsActions.tsx packages/fe/src/app/Pages/Ods/OdssPage.tsx packages/fe/src/app/Pages/Ods/useOdsActions.spec.tsx packages/fe/src/app/Pages/Ods/OdssPage.spec.tsx packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.ts packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.ts packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts
git commit -m "feat: add async non-startingblocks ods delete by dbinstanceid" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
