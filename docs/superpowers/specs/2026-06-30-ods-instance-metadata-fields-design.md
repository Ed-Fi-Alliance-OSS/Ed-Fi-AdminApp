# Design: ODS Instance Metadata Fields (status, databaseTemplate, databaseName)

**Date:** 2026-06-30
**Status:** Approved

## Background

The Admin API v2 endpoint `tenants/{name}/odsInstances/edOrgs` has been updated to return three new fields on each ODS instance object:

- `status` (`string | null`) — operational status of the ODS instance
- `databaseTemplate` (`string | null`) — the template used to provision the database
- `databaseName` (`string | null`) — the actual database name

These fields must be captured during the environment sync flow and persisted to the database. No API exposure is required at this time.

## Scope

- Capture the three new fields from the Admin API v2 response
- Persist them as nullable columns on the `ods` table
- Propagate them through the sync pipeline (DTO → interface → entity → sync logic)
- Provide database migrations for both PostgreSQL and MSSQL
- The existing `dbName` column and its fallback logic are unchanged

## Architecture

### Affected Packages

| Package | File | Change |
|---|---|---|
| `models` | `src/dtos/edfi-admin-api.dto.ts` | Add 3 optional fields to `OdsInstanceDto` |
| `models` | `src/interfaces/ods.interface.ts` | Add 3 nullable fields to `IOds` |
| `models-server` | `src/entities/ods.entity.ts` | Add 3 nullable `@Column` decorators to `Ods` |
| `api` | `src/sb-sync/sync-ods.ts` | Extend `SyncableOds` type; update delta logic |
| `api` | `src/sb-sync/edfi/adminapi-sync.service.ts` | Map new fields from raw API response into `TenantDto` |
| `api` | `src/utils/admin-api-data-adapter-utils.ts` | Propagate new fields through `transformTenantData` |
| `api` | `src/database/migrations/pgsql/` | New migration file + spec |
| `api` | `src/database/migrations/mssql/` | New migration file + spec |

## Data Model Changes

### `OdsInstanceDto` (`models/src/dtos/edfi-admin-api.dto.ts`)

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

### `IOds` interface (`models/src/interfaces/ods.interface.ts`)

```ts
export interface IOds extends IEntityBase {
  // ... existing fields ...
  status: string | null;           // new
  databaseTemplate: string | null; // new
  databaseName: string | null;     // new
}
```

### `Ods` entity (`models-server/src/entities/ods.entity.ts`)

```ts
@Column({ nullable: true })
status: string | null;

@Column({ nullable: true })
databaseTemplate: string | null;

@Column({ nullable: true })
databaseName: string | null;
```

## Sync Flow Changes

### `SyncableOds` (`api/src/sb-sync/sync-ods.ts`)

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

### `computeOdsListDeltas` (`api/src/sb-sync/sync-ods.ts`)

The `newOds` partial construction is updated to include the three new fields. The `hasChanges` check is also extended to detect changes to these fields so that updates are correctly triggered when the API returns new values.

### `adminapi-sync.service.ts` — TenantDto mapping (around line 835)

Map new fields from the raw API response when constructing the `TenantDto`:

```ts
odsInstances: (tenantDetails.odsInstances || []).map((instance: any) => ({
  id: instance.id ?? null,
  name: instance.name || 'Unknown ODS Instance',
  instanceType: instance.instanceType,
  status: instance.status ?? null,           // new
  databaseTemplate: instance.databaseTemplate ?? null, // new
  databaseName: instance.databaseName ?? null,         // new
  edOrgs: [...],
})),
```

### `processTenantData` — syncableOdss mapping (around line 111)

Pass the new fields through when building the `SyncableOds` array:

```ts
const syncableOdss = (transformedData.odss ?? []).map(ods => ({
  id: ods.odsInstanceId,
  name: ods.odsInstanceName,
  dbName: ods.odsInstanceName || `ods-${ods.odsInstanceId}`,
  status: ods.status ?? null,           // new
  databaseTemplate: ods.databaseTemplate ?? null, // new
  databaseName: ods.databaseName ?? null,         // new
  edorgs: [...],
}));
```

### `transformTenantData` (`api/src/utils/admin-api-data-adapter-utils.ts`)

Propagate the new fields into the `IOds` partial:

```ts
const odsData: Partial<IOds> = {
  // ... existing fields ...
  status: instance.status ?? null,
  databaseTemplate: instance.databaseTemplate ?? null,
  databaseName: instance.databaseName ?? null,
};
```

## Database Migrations

Migration timestamp: `1751299288000`
Migration class name: `AddOdsInstanceMetadataFields1751299288000`

### PostgreSQL (`pgsql/1751299288000-AddOdsInstanceMetadataFields.ts`)

```sql
-- up
ALTER TABLE "ods" ADD "status" character varying;
ALTER TABLE "ods" ADD "databaseTemplate" character varying;
ALTER TABLE "ods" ADD "databaseName" character varying;

-- down
ALTER TABLE "ods" DROP COLUMN "status";
ALTER TABLE "ods" DROP COLUMN "databaseTemplate";
ALTER TABLE "ods" DROP COLUMN "databaseName";
```

### MSSQL (`mssql/1751299288000-AddOdsInstanceMetadataFields.ts`)

```sql
-- up
ALTER TABLE [ods] ADD [status] NVARCHAR(255) NULL;
ALTER TABLE [ods] ADD [databaseTemplate] NVARCHAR(255) NULL;
ALTER TABLE [ods] ADD [databaseName] NVARCHAR(255) NULL;

-- down
ALTER TABLE [ods] DROP COLUMN [status];
ALTER TABLE [ods] DROP COLUMN [databaseTemplate];
ALTER TABLE [ods] DROP COLUMN [databaseName];
```

Each migration has a corresponding `.spec.ts` that calls `runMigrationSmokeTest(AddOdsInstanceMetadataFields1751299288000)`.

## Error Handling

- All three new fields are nullable on both the DTO and entity sides. If the Admin API omits them (e.g., older response), the sync will store `null` without error.
- No existing fallback logic (`dbName`) is affected.

## Testing

- Migration smoke tests (`.spec.ts`) for both pgsql and mssql follow the existing `runMigrationSmokeTest` pattern.
- Unit tests for `computeOdsListDeltas` should cover the case where `status`, `databaseTemplate`, or `databaseName` changes and triggers an update.

## Out of Scope

- Exposing the new fields via GET API endpoints
- UI changes
- Changes to `dbName` or its fallback logic
