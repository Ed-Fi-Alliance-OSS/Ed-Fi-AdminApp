# ODS `dbInstanceId` Backfill Design

## Context

The existing ODS metadata work added nullable persistence for `status`, `databaseTemplate`, `databaseName`, and `instanceType` through migration `1751299288000-AddOdsInstanceMetadataFields`. We now need to add one more nullable field, `dbInstanceId` (integer), and keep parity through the same backend persistence/sync pipeline.

## Scope

In scope:
- Update the existing migration files (pgsql + mssql) instead of creating a new migration
- Add nullable `dbInstanceId` persistence and propagation across backend DTOs/interfaces/entity/sync mapping
- Add targeted tests for sync delta behavior and migration smoke coverage patterns

Out of scope:
- FE display changes for ODS pages
- New migration timestamp/class creation

## Design

### 1) Database migration changes (existing migration only)

Modify both:
- `packages/api/src/database/migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields.ts`
- `packages/api/src/database/migrations/mssql/1751299288000-AddOdsInstanceMetadataFields.ts`

`up` will add a nullable integer column `dbInstanceId` to `ods`.

`down` will drop `dbInstanceId` first, then continue dropping existing metadata columns in current reverse order.

Class name and timestamp remain unchanged.

### 2) Data model and contract propagation

Add nullable `dbInstanceId` to:
- `Ods` entity
- `IOds`
- ODS DTO surfaces that mirror persisted ODS fields (`GetOdsDto`, and any post/put DTO contracts currently carrying the metadata set)
- `OdsInstanceDto` in `edfi-admin-api.dto.ts` as optional nullable numeric field

### 3) Sync and mapping pipeline propagation

Propagate with existing null normalization (`?? null`) across:
- Admin API v2 tenant/ODS response mapping (`admin-api.v2.service.ts`)
- `transformTenantData` adapter
- `SyncableOds` type
- `computeOdsListDeltas` new object construction and change-detection comparisons for both id-based and dbName-based paths
- Sync service mapping from transformed ODS data to `SyncableOds`

## Error handling behavior

No new catch/suppress logic. Existing behavior remains: absent source values are normalized to `null` at mapping boundaries to avoid false-positive updates.

## Testing strategy

Targeted updates:
- Keep migration smoke test files for both engines intact (same migration class invocation)
- Extend `sync-ods.spec.ts` with `dbInstanceId` cases:
  - update detected when value changes
  - no delta when existing `null` vs incoming `undefined` (both id-based and dbName-based path patterns)

## Risks and mitigations

- **Risk:** false update churn when source omits field  
  **Mitigation:** enforce `?? null` normalization in all mapping points and in delta comparisons.

- **Risk:** inconsistent field naming (`dbInstanceId` vs existing `odsInstanceId`)  
  **Mitigation:** preserve `dbInstanceId` strictly as metadata field; do not alter existing identifier semantics.

## Success criteria

1. Existing migration files include nullable `dbInstanceId` add/drop logic in both engines.
2. `dbInstanceId` is persisted and round-tripped through backend ODS model/DTO contracts.
3. Sync pipeline correctly maps and compares `dbInstanceId` without noisy updates.
4. Targeted tests for sync delta behavior pass with the new field.
