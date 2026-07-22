# ODS dbInstanceId Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add nullable integer `dbInstanceId` to the existing ODS metadata migration and propagate it through backend contracts, mapping, sync, and persistence behavior.

**Architecture:** Reuse the same end-to-end path used for `status`, `databaseTemplate`, `databaseName`, and `instanceType`: Admin API response DTO -> v2 mapping -> tenant transform -> sync delta comparison -> ODS entity/DTO persistence. Keep migration timestamp/class unchanged and append `dbInstanceId` as another nullable column in both DB engines. Use targeted API/model tests to verify mapping and delta behavior without introducing FE scope.

**Tech Stack:** TypeScript, NestJS, TypeORM, Jest (Nx test runner), PostgreSQL + MSSQL migrations

---

## File Structure and Responsibilities

- `packages/models/src/dtos/edfi-admin-api.dto.ts`  
  Source contract for Admin API tenant ODS payload (`OdsInstanceDto`).
- `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.ts`  
  Maps raw Admin API v2 ODS payload into `OdsInstanceDto`.
- `packages/api/src/utils/admin-api-data-adapter-utils.ts`  
  Converts API tenant data into `Partial<IOds>` records for persistence sync.
- `packages/api/src/sb-sync/edfi/adminapi-sync.service.ts`  
  Builds `SyncableOds` payload before delta processing.
- `packages/api/src/sb-sync/sync-ods.ts`  
  Delta comparison logic for id-based and dbName-based ODS paths.
- `packages/models/src/interfaces/ods.interface.ts`  
  Shared persisted ODS interface.
- `packages/models/src/dtos/ods.dto.ts`  
  API DTO surfaces that expose persisted ODS metadata.
- `packages/models-server/src/entities/ods.entity.ts`  
  TypeORM persisted `ods` table shape.
- `packages/api/src/database/migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields.ts`  
  Existing PostgreSQL migration to extend with `dbInstanceId`.
- `packages/api/src/database/migrations/mssql/1751299288000-AddOdsInstanceMetadataFields.ts`  
  Existing MSSQL migration to extend with `dbInstanceId`.
- `packages/api/src/utils/admin-api-data-adapter-utils.spec.ts`  
  Adapter mapping tests.
- `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts`  
  v2 tenant mapping tests.
- `packages/api/src/sb-sync/sync-ods.spec.ts`  
  Delta behavior tests.

### Task 1: Add failing mapping tests for `dbInstanceId`

**Files:**
- Modify: `packages/api/src/utils/admin-api-data-adapter-utils.spec.ts`
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts`
- Test: `packages/api/src/utils/admin-api-data-adapter-utils.spec.ts`
- Test: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// admin-api-data-adapter-utils.spec.ts (inside existing "complete tenant data" test fixture)
odsInstances: [
  {
    id: 100,
    dbInstanceId: 444,
    name: 'ODS Instance 1',
    instanceType: 'Production',
    status: 'active',
    databaseTemplate: 'Minimal',
    databaseName: 'edfi_ods_2026',
    edOrgs: [],
  },
];

// add expectation
expect(ods).toMatchObject({
  odsInstanceId: 100,
  dbInstanceId: 444,
  odsInstanceName: 'ODS Instance 1',
});
```

```ts
// admin-api.v2.service.spec.ts (tenant details fixture)
odsInstances: [
  {
    id: 999,
    dbInstanceId: 5555,
    name: 'Test ODS',
    instanceType: 'Production',
    educationOrganizations: [],
  },
];

// add expectation
expect(result[0].odsInstances![0].dbInstanceId).toBe(5555);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npx nx test api --runTestsByPath packages/api/src/utils/admin-api-data-adapter-utils.spec.ts packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts
```

Expected: FAIL because `dbInstanceId` is not yet mapped through `OdsInstanceDto` and service/adapter mapping.

- [ ] **Step 3: Write minimal implementation to pass mapping tests**

```ts
// packages/models/src/dtos/edfi-admin-api.dto.ts
export interface OdsInstanceDto {
  id: number | null;
  dbInstanceId?: number | null;
  name: string;
  instanceType?: string;
  status?: string | null;
  databaseTemplate?: string | null;
  databaseName?: string | null;
  edOrgs?: EducationOrganizationDto[];
}
```

```ts
// packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.ts
const odsInstance: OdsInstanceDto = {
  id: instance.id ?? null,
  dbInstanceId: instance.dbInstanceId ?? null,
  name: instance.name || 'Unknown ODS Instance',
  instanceType: instance.instanceType,
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
};
```

```ts
// packages/api/src/utils/admin-api-data-adapter-utils.ts
const odsData: Partial<IOds> = {
  id: 0,
  odsInstanceId: instance.id,
  dbInstanceId: instance.dbInstanceId ?? null,
  odsInstanceName: instance.name,
  instanceType: instance.instanceType ?? null,
  status: instance.status ?? null,
  databaseTemplate: instance.databaseTemplate ?? null,
  databaseName: instance.databaseName ?? null,
  ownerships: [],
  edfiTenantId: 0,
  sbEnvironmentId: sbEnvironment.id,
  edorgs: [],
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx nx test api --runTestsByPath packages/api/src/utils/admin-api-data-adapter-utils.spec.ts packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/models/src/dtos/edfi-admin-api.dto.ts packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.ts packages/api/src/utils/admin-api-data-adapter-utils.ts packages/api/src/utils/admin-api-data-adapter-utils.spec.ts packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts
git commit -m "feat: map dbInstanceId through admin api v2 and tenant adapter" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 2: Add failing sync delta tests and implement `dbInstanceId` comparison

**Files:**
- Modify: `packages/api/src/sb-sync/sync-ods.spec.ts`
- Modify: `packages/api/src/sb-sync/sync-ods.ts`
- Modify: `packages/api/src/sb-sync/edfi/adminapi-sync.service.ts`
- Test: `packages/api/src/sb-sync/sync-ods.spec.ts`

- [ ] **Step 1: Write failing sync tests**

```ts
it('updates an existing ODS when dbInstanceId changes', () => {
  const existingOds = makeOds({
    id: 1, odsInstanceId: 5, odsInstanceName: 'ODS', dbName: 'ods_db', dbInstanceId: 10,
  } as any);
  const incoming: SyncableOds[] = [{ id: 5, name: 'ODS', dbName: 'ods_db', dbInstanceId: 11 }];
  const result = computeOdsListDeltas(incoming, [existingOds], tenant, makeEntityManager());
  expect(result.update).toHaveLength(1);
  expect((result.update[0] as any).dbInstanceId).toBe(11);
});

it('produces no delta when existing dbInstanceId is null and incoming is undefined', () => {
  const existingOds = makeOds({
    id: 3, odsInstanceId: null, odsInstanceName: null, dbName: 'ods_alpha', dbInstanceId: null,
  } as any);
  const incoming: SyncableOds[] = [{ id: null, name: null, dbName: 'ods_alpha' }];
  const result = computeOdsListDeltas(incoming, [existingOds], tenant, makeEntityManager());
  expect(result.update).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify failure**

Run:
```bash
npx nx test api --runTestsByPath packages/api/src/sb-sync/sync-ods.spec.ts
```

Expected: FAIL because `SyncableOds` and delta comparisons do not include `dbInstanceId`.

- [ ] **Step 3: Implement minimal sync changes**

```ts
// packages/api/src/sb-sync/sync-ods.ts
export type SyncableOds = {
  id: number | null;
  dbInstanceId?: number | null;
  name: string | null;
  dbName: string;
  instanceType?: string | null;
  status?: string | null;
  databaseTemplate?: string | null;
  databaseName?: string | null;
  edorgs?: SbV1MetaEdorg[];
};

const newOds: DeepPartial<Ods> = {
  sbEnvironmentId: edfiTenant.sbEnvironmentId,
  edfiTenantId: edfiTenant.id,
  dbName: sbOds.dbName,
  odsInstanceId: sbOds.id,
  odsInstanceName: sbOds.name,
  dbInstanceId: sbOds.dbInstanceId ?? null,
  instanceType: sbOds.instanceType ?? null,
  status: sbOds.status ?? null,
  databaseTemplate: sbOds.databaseTemplate ?? null,
  databaseName: sbOds.databaseName ?? null,
};

const hasChanges =
  existingOds.dbName !== sbOds.dbName ||
  existingOds.odsInstanceName !== sbOds.name ||
  (existingOds.instanceType ?? null) !== (sbOds.instanceType ?? null) ||
  (existingOds.status ?? null) !== (sbOds.status ?? null) ||
  (existingOds.databaseTemplate ?? null) !== (sbOds.databaseTemplate ?? null) ||
  (existingOds.databaseName ?? null) !== (sbOds.databaseName ?? null) ||
  (existingOds.dbInstanceId ?? null) !== (sbOds.dbInstanceId ?? null);
```

```ts
// packages/api/src/sb-sync/edfi/adminapi-sync.service.ts (both mapping locations)
const syncableOdss = (transformedData.odss ?? []).map(ods => ({
  id: ods.odsInstanceId,
  dbInstanceId: ods.dbInstanceId ?? null,
  name: ods.odsInstanceName,
  dbName: ods.odsInstanceName || `ods-${ods.odsInstanceId}`,
  instanceType: ods.instanceType ?? null,
  status: ods.status ?? null,
  databaseTemplate: ods.databaseTemplate ?? null,
  databaseName: ods.databaseName ?? null,
  edorgs: ods.edorgs?.map(edorg => ({
    educationorganizationid: edorg.educationOrganizationId,
    nameofinstitution: edorg.nameOfInstitution,
    shortnameofinstitution: edorg.shortNameOfInstitution || null,
    discriminator: edorg.discriminator,
    parent: edorg.parentId,
  })) || [],
}));
```

- [ ] **Step 4: Run test to verify pass**

Run:
```bash
npx nx test api --runTestsByPath packages/api/src/sb-sync/sync-ods.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/sb-sync/sync-ods.ts packages/api/src/sb-sync/edfi/adminapi-sync.service.ts packages/api/src/sb-sync/sync-ods.spec.ts
git commit -m "feat: include dbInstanceId in ods sync delta logic" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 3: Persist `dbInstanceId` in shared contracts, entity, and existing migration

**Files:**
- Modify: `packages/models/src/interfaces/ods.interface.ts`
- Modify: `packages/models/src/dtos/ods.dto.ts`
- Modify: `packages/models-server/src/entities/ods.entity.ts`
- Modify: `packages/api/src/database/migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields.ts`
- Modify: `packages/api/src/database/migrations/mssql/1751299288000-AddOdsInstanceMetadataFields.ts`
- Test: `packages/api/src/database/migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields.spec.ts`
- Test: `packages/api/src/database/migrations/mssql/1751299288000-AddOdsInstanceMetadataFields.spec.ts`

- [ ] **Step 1: Add failing contract expectation**

```ts
// packages/api/src/utils/admin-api-data-adapter-utils.spec.ts (existing "complete tenant data" assertion block)
expect(ods).toMatchObject({
  odsInstanceId: 100,
  dbInstanceId: 444,
  odsInstanceName: 'ODS Instance 1',
});
```

This expectation anchors the persisted contract and must remain in the suite while implementing Task 3.

- [ ] **Step 2: Implement persistence shape changes**

```ts
// packages/models/src/interfaces/ods.interface.ts
dbInstanceId: number | null;
```

```ts
// packages/models/src/dtos/ods.dto.ts
@Expose()
dbInstanceId: number | null;
```

```ts
// packages/models-server/src/entities/ods.entity.ts
@Column({ nullable: true })
dbInstanceId: number | null;
```

```ts
// pgsql migration up/down
await queryRunner.query(`ALTER TABLE "ods" ADD "dbInstanceId" integer`);
// in down (first drop):
await queryRunner.query(`ALTER TABLE "ods" DROP COLUMN "dbInstanceId"`);
```

```ts
// mssql migration up/down
await queryRunner.query(`ALTER TABLE [ods] ADD [dbInstanceId] int NULL`);
// in down (first drop):
await queryRunner.query(`ALTER TABLE [ods] DROP COLUMN [dbInstanceId]`);
```

- [ ] **Step 3: Run targeted tests/build checks**

Run:
```bash
npx nx test api --runTestsByPath packages/api/src/database/migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields.spec.ts packages/api/src/database/migrations/mssql/1751299288000-AddOdsInstanceMetadataFields.spec.ts
npx nx test api --runTestsByPath packages/api/src/utils/admin-api-data-adapter-utils.spec.ts
npm run build
```

Expected: PASS for tests and successful build.

- [ ] **Step 4: Commit**

```bash
git add packages/models/src/interfaces/ods.interface.ts packages/models/src/dtos/ods.dto.ts packages/models-server/src/entities/ods.entity.ts packages/api/src/database/migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields.ts packages/api/src/database/migrations/mssql/1751299288000-AddOdsInstanceMetadataFields.ts
git commit -m "feat: persist dbInstanceId in ods models and existing migration" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 4: Final targeted regression pass and integration commit

**Files:**
- Modify: none (verification task; only edit files if a regression test fails)
- Test: `packages/api/src/sb-sync/sync-ods.spec.ts`
- Test: `packages/api/src/utils/admin-api-data-adapter-utils.spec.ts`
- Test: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts`
- Test: `packages/api/src/database/migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields.spec.ts`
- Test: `packages/api/src/database/migrations/mssql/1751299288000-AddOdsInstanceMetadataFields.spec.ts`

- [ ] **Step 1: Run the consolidated targeted suite**

Run:
```bash
npx nx test api --runTestsByPath packages/api/src/sb-sync/sync-ods.spec.ts packages/api/src/utils/admin-api-data-adapter-utils.spec.ts packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.spec.ts packages/api/src/database/migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields.spec.ts packages/api/src/database/migrations/mssql/1751299288000-AddOdsInstanceMetadataFields.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run full build required by repository guidance**

Run:
```bash
npm run build
```

Expected: successful FE + API build.

- [ ] **Step 3: Commit final integration adjustments (only if needed)**

```bash
git add -A
git commit -m "test: finalize dbInstanceId metadata propagation coverage" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
