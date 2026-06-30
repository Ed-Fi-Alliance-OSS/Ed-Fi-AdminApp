# ODS Instance Metadata Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thread three new fields (`status`, `databaseTemplate`, `databaseName`) returned by the Admin API v2 `tenants/{name}/odsInstances/edOrgs` endpoint through the existing sync pipeline and persist them in the database.

**Architecture:** The sync pipeline already exists and is unchanged structurally. The work is purely additive: add the three fields to the shared DTO and interface, add nullable columns to the `Ods` entity, update the two mapping points in the existing code that convert the raw API response to `OdsInstanceDto`, propagate the fields through `SyncableOds` and the delta change-detection logic, and provide DB migrations for both PostgreSQL and MSSQL.

**Tech Stack:** TypeScript, NestJS, TypeORM, PostgreSQL, MSSQL, Jest.

---

## File Map

| Action | File | What changes |
|---|---|---|
| Modify | `packages/models/src/dtos/edfi-admin-api.dto.ts` | Add 3 optional fields to `OdsInstanceDto` |
| Modify | `packages/models/src/interfaces/ods.interface.ts` | Add 3 nullable fields to `IOds` |
| Modify | `packages/models-server/src/entities/ods.entity.ts` | Add 3 `@Column({ nullable: true })` fields to `Ods` |
| Modify | `packages/api/src/sb-sync/sync-ods.ts` | Extend `SyncableOds`; update `newOds` construction + `hasChanges` in `computeOdsListDeltas` |
| Modify | `packages/api/src/sb-sync/sync-ods.spec.ts` | Add tests for new-field change detection |
| Modify | `packages/api/src/utils/admin-api-data-adapter-utils.ts` | Propagate 3 fields in `transformTenantData` |
| Modify | `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.ts` | Map 3 fields in `getTenants` OdsInstanceDto mapping (~line 1322) |
| Modify | `packages/api/src/sb-sync/edfi/adminapi-sync.service.ts` | Map 3 fields in `syncTenantData` TenantDto mapping (~line 835) |
| Create | `packages/api/src/database/migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields.ts` | PostgreSQL migration |
| Create | `packages/api/src/database/migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields.spec.ts` | PostgreSQL migration smoke test |
| Create | `packages/api/src/database/migrations/mssql/1751299288000-AddOdsInstanceMetadataFields.ts` | MSSQL migration |
| Create | `packages/api/src/database/migrations/mssql/1751299288000-AddOdsInstanceMetadataFields.spec.ts` | MSSQL migration smoke test |

---

## Task 1: Extend `OdsInstanceDto` and `IOds`

**Files:**
- Modify: `packages/models/src/dtos/edfi-admin-api.dto.ts`
- Modify: `packages/models/src/interfaces/ods.interface.ts`

- [ ] **Step 1: Update `OdsInstanceDto`**

In `packages/models/src/dtos/edfi-admin-api.dto.ts`, find the `OdsInstanceDto` interface (around line 410) and add the three new optional fields:

```ts
export interface OdsInstanceDto {
  id: number | null;
  name: string;
  instanceType?: string;
  status?: string | null;           // new
  databaseTemplate?: string | null; // new
  databaseName?: string | null;     // new
  edOrgs?: EducationOrganizationDto[];
}
```

- [ ] **Step 2: Update `IOds`**

In `packages/models/src/interfaces/ods.interface.ts`, add the three nullable fields:

```ts
export interface IOds extends IEntityBase {
  ownerships: IOwnership[];

  edfiTenant: IEdfiTenant;
  edfiTenantId: number;

  sbEnvironmentId: number;

  odsInstanceId: number | null;
  odsInstanceName: string | null;
  dbName: string;
  status: string | null;           // new
  databaseTemplate: string | null; // new
  databaseName: string | null;     // new
  edorgs: IEdorg[];

  integrationApps: IIntegrationApp[];
}
```

- [ ] **Step 3: Build models to verify no type errors**

```bash
npm run build:models
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/models/src/dtos/edfi-admin-api.dto.ts packages/models/src/interfaces/ods.interface.ts
git commit -m "feat: add status, databaseTemplate, databaseName to OdsInstanceDto and IOds"
```

---

## Task 2: Add columns to the `Ods` entity

**Files:**
- Modify: `packages/models-server/src/entities/ods.entity.ts`

- [ ] **Step 1: Add the three nullable columns**

In `packages/models-server/src/entities/ods.entity.ts`, add after the `odsInstanceName` column:

```ts
@Column({ nullable: true })
odsInstanceName: string | null;

@Column({ nullable: true })
status: string | null;

@Column({ nullable: true })
databaseTemplate: string | null;

@Column({ nullable: true })
databaseName: string | null;
```

The full updated entity should look like:

```ts
import { IEdorg, IOds, IOwnership, IEdfiTenant, IIntegrationApp } from '@edanalytics/models';
import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
export class Ods extends EntityBase implements IOds {
  @OneToMany('Ownership', (ownership: IOwnership) => ownership.ods)
  ownerships: IOwnership[];

  @ManyToOne('EdfiTenant', (edfiTenant: IEdfiTenant) => edfiTenant.odss, { onDelete: 'CASCADE' })
  edfiTenant: IEdfiTenant;
  @Column()
  edfiTenantId: number;

  @Column()
  sbEnvironmentId: number;

  @OneToMany('Edorg', (edorg: IEdorg) => edorg.ods)
  edorgs: IEdorg[];

  @OneToMany(
    'IntegrationApp',
    (integrationApp: IIntegrationApp) => integrationApp.integrationProvider
  )
  integrationApps: IIntegrationApp[];

  @Column({ nullable: true })
  odsInstanceId: number | null;

  @Column({ nullable: true })
  odsInstanceName: string | null;

  @Column({ nullable: true })
  status: string | null;

  @Column({ nullable: true })
  databaseTemplate: string | null;

  @Column({ nullable: true })
  databaseName: string | null;

  @Column()
  dbName: string;

  get displayName() {
    return this.dbName;
  }
}
```

- [ ] **Step 2: Build models-server to verify no type errors**

```bash
npm run build:models-server
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/models-server/src/entities/ods.entity.ts
git commit -m "feat: add status, databaseTemplate, databaseName columns to Ods entity"
```

---

## Task 3: Database migrations (PostgreSQL + MSSQL)

**Files:**
- Create: `packages/api/src/database/migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields.ts`
- Create: `packages/api/src/database/migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields.spec.ts`
- Create: `packages/api/src/database/migrations/mssql/1751299288000-AddOdsInstanceMetadataFields.ts`
- Create: `packages/api/src/database/migrations/mssql/1751299288000-AddOdsInstanceMetadataFields.spec.ts`

- [ ] **Step 1: Create PostgreSQL migration**

Create `packages/api/src/database/migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOdsInstanceMetadataFields1751299288000 implements MigrationInterface {
  name = 'AddOdsInstanceMetadataFields1751299288000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ods" ADD "status" character varying`);
    await queryRunner.query(`ALTER TABLE "ods" ADD "databaseTemplate" character varying`);
    await queryRunner.query(`ALTER TABLE "ods" ADD "databaseName" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ods" DROP COLUMN "databaseName"`);
    await queryRunner.query(`ALTER TABLE "ods" DROP COLUMN "databaseTemplate"`);
    await queryRunner.query(`ALTER TABLE "ods" DROP COLUMN "status"`);
  }
}
```

- [ ] **Step 2: Create PostgreSQL migration smoke test**

Create `packages/api/src/database/migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields.spec.ts`:

```ts
import 'reflect-metadata';
import { AddOdsInstanceMetadataFields1751299288000 } from './1751299288000-AddOdsInstanceMetadataFields';
import { runMigrationSmokeTest } from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(AddOdsInstanceMetadataFields1751299288000);
```

- [ ] **Step 3: Create MSSQL migration**

Create `packages/api/src/database/migrations/mssql/1751299288000-AddOdsInstanceMetadataFields.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOdsInstanceMetadataFields1751299288000 implements MigrationInterface {
  name = 'AddOdsInstanceMetadataFields1751299288000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE [ods] ADD [status] NVARCHAR(255) NULL`);
    await queryRunner.query(`ALTER TABLE [ods] ADD [databaseTemplate] NVARCHAR(255) NULL`);
    await queryRunner.query(`ALTER TABLE [ods] ADD [databaseName] NVARCHAR(255) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE [ods] DROP COLUMN [databaseName]`);
    await queryRunner.query(`ALTER TABLE [ods] DROP COLUMN [databaseTemplate]`);
    await queryRunner.query(`ALTER TABLE [ods] DROP COLUMN [status]`);
  }
}
```

- [ ] **Step 4: Create MSSQL migration smoke test**

Create `packages/api/src/database/migrations/mssql/1751299288000-AddOdsInstanceMetadataFields.spec.ts`:

```ts
import 'reflect-metadata';
import { AddOdsInstanceMetadataFields1751299288000 } from './1751299288000-AddOdsInstanceMetadataFields';
import { runMigrationSmokeTest } from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(AddOdsInstanceMetadataFields1751299288000);
```

- [ ] **Step 5: Run migration smoke tests**

```bash
npm run test:api -- --testPathPattern="1751299288000"
```

Expected: 2 test suites pass (pgsql + mssql).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/database/migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields.ts
git add packages/api/src/database/migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields.spec.ts
git add packages/api/src/database/migrations/mssql/1751299288000-AddOdsInstanceMetadataFields.ts
git add packages/api/src/database/migrations/mssql/1751299288000-AddOdsInstanceMetadataFields.spec.ts
git commit -m "feat: add DB migrations for ODS instance metadata fields (pgsql + mssql)"
```

---

## Task 4: Extend `SyncableOds` and update delta logic

**Files:**
- Modify: `packages/api/src/sb-sync/sync-ods.ts`
- Modify: `packages/api/src/sb-sync/sync-ods.spec.ts`

- [ ] **Step 1: Write failing tests for new-field change detection**

In `packages/api/src/sb-sync/sync-ods.spec.ts`, add these test cases inside the existing `describe('computeOdsListDeltas — id-based ODS ...')` block, after the existing tests:

```ts
it('updates an existing ODS when status changes', () => {
  const existingOds = makeOds({ id: 1, odsInstanceId: 5, odsInstanceName: 'ODS', dbName: 'ods_db', status: 'active' } as any);
  const incoming: SyncableOds[] = [{ id: 5, name: 'ODS', dbName: 'ods_db', status: 'inactive' }];
  const em = makeEntityManager();

  const result = computeOdsListDeltas(incoming, [existingOds], tenant, em);

  expect(result.update).toHaveLength(1);
  expect((result.update[0] as any).status).toBe('inactive');
  expect(result.insert).toHaveLength(0);
});

it('updates an existing ODS when databaseTemplate changes', () => {
  const existingOds = makeOds({ id: 1, odsInstanceId: 5, odsInstanceName: 'ODS', dbName: 'ods_db', databaseTemplate: 'template_a' } as any);
  const incoming: SyncableOds[] = [{ id: 5, name: 'ODS', dbName: 'ods_db', databaseTemplate: 'template_b' }];
  const em = makeEntityManager();

  const result = computeOdsListDeltas(incoming, [existingOds], tenant, em);

  expect(result.update).toHaveLength(1);
  expect((result.update[0] as any).databaseTemplate).toBe('template_b');
});

it('updates an existing ODS when databaseName changes', () => {
  const existingOds = makeOds({ id: 1, odsInstanceId: 5, odsInstanceName: 'ODS', dbName: 'ods_db', databaseName: 'db_old' } as any);
  const incoming: SyncableOds[] = [{ id: 5, name: 'ODS', dbName: 'ods_db', databaseName: 'db_new' }];
  const em = makeEntityManager();

  const result = computeOdsListDeltas(incoming, [existingOds], tenant, em);

  expect(result.update).toHaveLength(1);
  expect((result.update[0] as any).databaseName).toBe('db_new');
});

it('produces no delta when all new fields are unchanged', () => {
  const existingOds = makeOds({
    id: 1, odsInstanceId: 5, odsInstanceName: 'ODS', dbName: 'ods_db',
    status: 'active', databaseTemplate: 'template_a', databaseName: 'db_one',
  } as any);
  const incoming: SyncableOds[] = [{
    id: 5, name: 'ODS', dbName: 'ods_db',
    status: 'active', databaseTemplate: 'template_a', databaseName: 'db_one',
  }];
  const em = makeEntityManager();

  const result = computeOdsListDeltas(incoming, [existingOds], tenant, em);

  expect(result.insert).toHaveLength(0);
  expect(result.update).toHaveLength(0);
  expect(result.delete).toHaveLength(0);
});
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
npm run test:api -- --testPathPattern="sync-ods.spec"
```

Expected: the 4 new tests FAIL (the fields are not yet threaded through the delta logic).

- [ ] **Step 3: Extend `SyncableOds` type**

In `packages/api/src/sb-sync/sync-ods.ts`, update the `SyncableOds` type:

```ts
export type SyncableOds = {
  id: number | null;
  name: string | null;
  dbName: string;
  status?: string | null;
  databaseTemplate?: string | null;
  databaseName?: string | null;
  edorgs?: SbV1MetaEdorg[];
};
```

- [ ] **Step 4: Update `computeOdsListDeltas` — id-based path**

In `packages/api/src/sb-sync/sync-ods.ts`, inside `computeOdsListDeltas`, find the id-based `newOds` construction (inside the `[...metaOdssById.values()].forEach` block) and update it:

```ts
const newOds: DeepPartial<Ods> = {
  sbEnvironmentId: edfiTenant.sbEnvironmentId,
  edfiTenantId: edfiTenant.id,
  dbName: sbOds.dbName,
  odsInstanceId: sbOds.id,
  odsInstanceName: sbOds.name,
  status: sbOds.status ?? null,
  databaseTemplate: sbOds.databaseTemplate ?? null,
  databaseName: sbOds.databaseName ?? null,
};
```

Then update the `hasChanges` check in the same block to include the three new fields:

```ts
const hasChanges =
  existingOds.dbName !== sbOds.dbName ||
  existingOds.odsInstanceName !== sbOds.name ||
  existingOds.status !== (sbOds.status ?? null) ||
  existingOds.databaseTemplate !== (sbOds.databaseTemplate ?? null) ||
  existingOds.databaseName !== (sbOds.databaseName ?? null);
```

- [ ] **Step 5: Run the new tests to confirm they pass**

```bash
npm run test:api -- --testPathPattern="sync-ods.spec"
```

Expected: all tests in the file pass.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/sb-sync/sync-ods.ts packages/api/src/sb-sync/sync-ods.spec.ts
git commit -m "feat: propagate status, databaseTemplate, databaseName through SyncableOds delta logic"
```

---

## Task 5: Update `transformTenantData`

**Files:**
- Modify: `packages/api/src/utils/admin-api-data-adapter-utils.ts`

- [ ] **Step 1: Propagate the three fields in `transformTenantData`**

In `packages/api/src/utils/admin-api-data-adapter-utils.ts`, update the `odsData` partial inside the `.map()`:

```ts
export const transformTenantData = (apiTenants: TenantDto, sbEnvironment: SbEnvironment): Partial<EdfiTenant> => {
  return {
    name: apiTenants.name,
    sbEnvironmentId: sbEnvironment.id,
    created: new Date(),
    odss: apiTenants.odsInstances?.map((instance: OdsInstanceDto) => {
      const odsData: Partial<IOds> = {
        id: 0,
        odsInstanceId: instance.id,
        odsInstanceName: instance.name,
        status: instance.status ?? null,
        databaseTemplate: instance.databaseTemplate ?? null,
        databaseName: instance.databaseName ?? null,
        ownerships: [],
        edfiTenantId: 0,
        sbEnvironmentId: sbEnvironment.id,
        edorgs: instance.edOrgs?.map((edorg: EducationOrganizationDto) => {
          const edorgData: Partial<IEdorg> = {
            odsInstanceId: edorg.instanceId,
            educationOrganizationId: edorg.educationOrganizationId,
            nameOfInstitution: edorg.nameOfInstitution,
            shortNameOfInstitution: edorg.shortNameOfInstitution || null,
            discriminator: edorg.discriminator as EdorgType,
            parentId: edorg.parentId,
          };
          return edorgData as IEdorg;
        }) || []
      };
      return odsData as IOds;
    }) || [],
  };
};
```

- [ ] **Step 2: Build to verify no type errors**

```bash
npm run build:api
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/utils/admin-api-data-adapter-utils.ts
git commit -m "feat: propagate status, databaseTemplate, databaseName in transformTenantData"
```

---

## Task 6: Update the two API response mapping points

**Files:**
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.ts`
- Modify: `packages/api/src/sb-sync/edfi/adminapi-sync.service.ts`

### Mapping point 1 — `getTenants` in `admin-api.v2.service.ts`

- [ ] **Step 1: Add the three fields to the `OdsInstanceDto` construction in `getTenants`**

In `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.ts`, find the `OdsInstanceDto` construction inside `getTenants` (~line 1322):

```ts
const odsInstance: OdsInstanceDto = {
  id: instance.id ?? null,
  name: instance.name || 'Unknown ODS Instance',
  instanceType: instance.instanceType,
  edOrgs: instance.educationOrganizations?.map((edOrg: any) => {
```

Replace it with:

```ts
const odsInstance: OdsInstanceDto = {
  id: instance.id ?? null,
  name: instance.name || 'Unknown ODS Instance',
  instanceType: instance.instanceType,
  status: instance.status ?? null,
  databaseTemplate: instance.databaseTemplate ?? null,
  databaseName: instance.databaseName ?? null,
  edOrgs: instance.educationOrganizations?.map((edOrg: any) => {
```

### Mapping point 2 — `syncTenantData` in `adminapi-sync.service.ts`

- [ ] **Step 2: Add the three fields to the `TenantDto` construction in `syncTenantData`**

In `packages/api/src/sb-sync/edfi/adminapi-sync.service.ts`, find the `TenantDto` construction inside `syncTenantData` (~line 835):

```ts
odsInstances: (tenantDetails.odsInstances || []).map((instance: any) => ({
  id: instance.id ?? null,
  name: instance.name || 'Unknown ODS Instance',
  instanceType: instance.instanceType,
  edOrgs: (instance.educationOrganizations || []).map((edOrg: any) => ({
```

Replace it with:

```ts
odsInstances: (tenantDetails.odsInstances || []).map((instance: any) => ({
  id: instance.id ?? null,
  name: instance.name || 'Unknown ODS Instance',
  instanceType: instance.instanceType,
  status: instance.status ?? null,
  databaseTemplate: instance.databaseTemplate ?? null,
  databaseName: instance.databaseName ?? null,
  edOrgs: (instance.educationOrganizations || []).map((edOrg: any) => ({
```

### Propagate through `processTenantData`

- [ ] **Step 3: Pass the three fields through `processTenantData` when building `syncableOdss`**

In `packages/api/src/sb-sync/edfi/adminapi-sync.service.ts`, find the `syncableOdss` mapping inside `processTenantData` (~line 111):

```ts
const syncableOdss = (transformedData.odss ?? []).map(ods => ({
  id: ods.odsInstanceId,
  name: ods.odsInstanceName,
  dbName: ods.odsInstanceName || `ods-${ods.odsInstanceId}`,
  edorgs: ods.edorgs?.map(edorg => ({
```

Replace it with:

```ts
const syncableOdss = (transformedData.odss ?? []).map(ods => ({
  id: ods.odsInstanceId,
  name: ods.odsInstanceName,
  dbName: ods.odsInstanceName || `ods-${ods.odsInstanceId}`,
  status: ods.status ?? null,
  databaseTemplate: ods.databaseTemplate ?? null,
  databaseName: ods.databaseName ?? null,
  edorgs: ods.edorgs?.map(edorg => ({
```

- [ ] **Step 4: Build to verify no type errors**

```bash
npm run build:api
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Run full API test suite**

```bash
npm run test:api
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.ts
git add packages/api/src/sb-sync/edfi/adminapi-sync.service.ts
git commit -m "feat: map status, databaseTemplate, databaseName from Admin API v2 response into sync pipeline"
```
