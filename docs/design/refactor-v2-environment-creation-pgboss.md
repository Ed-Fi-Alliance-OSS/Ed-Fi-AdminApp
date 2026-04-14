# Refactor v2 Environment Creation: Remove Tenant/ODS/EdOrg Form Fields & Delegate to pg_boss

## Problem

When creating a v2 Ed-Fi environment, the form currently asks the user to manually enter tenants, ODS instances, and education organizations. This is no longer needed because:

1. The Admin API already exposes this data and it is synced automatically.
2. There is an existing background sync mechanism (`refresh-resources`) that already handles this flow correctly via a pg_boss job.

## Goals

- Remove tenant, ODS, and EdOrg input fields from the v2 environment creation (and edit) form.
- After saving the environment record, enqueue a pg_boss background job (`ENV_SYNC_CHNL`) to fetch tenants/ODS/EdOrgs from the Admin API automatically.
- Mirror the pattern already used by `PUT /sb-environments/:id/refresh-resources`.

## Current Flow (v2)

```
POST /sb-environments
  → SbEnvironmentsEdFiService.create()
    → validateAdminApiUrl()
    → fetchOdsApiMetadata()                      ← auto-detect version/tenant mode
    → validateTenantsAndCreateCredentials()      ← creates credentials per tenant (from form data)
    → sbEnvironmentsRepository.save()            ← save environment record
    → syncv2Environment()
        → syncMultiTenantEnvironment() or syncSingleTenantEnvironment()
            → createAndSyncTenant() per tenant   ← saves tenant rows
            → syncTenantData()                   ← saves ODS + EdOrg rows
            → createAdminAPICredentialsV2()      ← saves Admin API credentials
```

## Proposed Flow (v2)

```
POST /sb-environments
  → SbEnvironmentsEdFiService.create()
    → validateAdminApiUrl()
    → fetchOdsApiMetadata()                      ← auto-detect version/tenant mode (unchanged)
    → sbEnvironmentsRepository.save()            ← save environment record (unchanged)
    → syncv2Environment()
        → boss.send(ENV_SYNC_CHNL, { sbEnvironmentId }, { expireInHours: 2 })
        → return syncJobId

  Controller polls SbSyncQueue until job completes (same pattern as metaArn and refresh-resources)
  → return PostSbEnvironmentResponseDto
```

The pg_boss consumer (`SbSyncConsumer.refreshSbEnvironment`) already handles environments with `adminApiUrl` by calling `adminapiSyncService.syncEnvironmentData()`, which:

1. Discovers tenants from the Admin API.
2. Provisions Admin API credentials for newly discovered tenants (`provisionCredentialsForNewTenants`).
3. Syncs ODS instances and EdOrgs per tenant.

## Changes Required

### Backend – `packages/api`

#### `sb-environments-global/sb-environments-edfi.services.ts`

- Inject `PgBossInstance` via `@Inject('PgBossInstance')` and `@InjectRepository(SbSyncQueue)`.
- Import `ENV_SYNC_CHNL`, `PgBossInstance` from `sb-sync.module` and `SbSyncQueue` from `models-server`.
- **Refactor `syncv2Environment`**: replace the body with a `boss.send(ENV_SYNC_CHNL, { sbEnvironmentId: sbEnvironment.id }, { expireInHours: 2 })` call and return the job ID.
- **Remove the `validateTenantsAndCreateCredentials` call** in `create()` for v2 multi-tenant (credential provisioning is now handled by the consumer).
- **Remove the `tenantCredentialsMap` parameter** from `syncv2Environment`.
- **Remove now-unused private methods** (no longer needed for v2 `create`):
  - `syncMultiTenantEnvironment`
  - `syncSingleTenantEnvironment`
  - `createAndSyncTenant`
  - `syncTenantData`
  - `createAdminAPICredentialsV2`
  - `validateTenantsAndCreateCredentials`

> **Note:** Keep `createODSObject`, `createODSObjectV1`, `saveSyncableOds`, `saveSyncableOdsV1` if they are still used by the update/v1 paths.

#### `sb-environments-global/sb-environments-global.controller.ts`

- In the `create()` method, replicate the `metaArn` polling pattern for the v2 EdFi path:
  - After `sbEnvironmentEdFiService.create()` returns the job ID, poll `SbSyncQueue` until the job completes or times out.
  - Return `toPostSbEnvironmentResponseDto({ id, syncQueue })`.

### Frontend – `packages/fe`

#### `Pages/SbEnvironmentGlobal/CreateSbEnvironmentGlobalPage.tsx`

- Remove the `TenantManagementSection` rendering block (currently shown when `currentVersion === 'v1' || currentVersion === 'v2'`).
- Remove the `TenantManagementSection` for v2 specifically. Keep it for v1.
- Remove the following from `validateForm()` for v2:
  - `validateFirstTenantHasOds` check for v2 single-tenant.
  - `validateTenantsExist` check for v2 multi-tenant.
  - Per-tenant and per-ODS validation loops when `currentVersion === 'v2'`.
- Remove the `tenants` watch and related state if no longer needed for v2.

#### `Pages/SbEnvironmentGlobal/EditSbEnvironmentGlobalPage.tsx`

- Remove `EditTenantManagementSection` rendering for v2 environments.
- Keep URL/name/label editing fields.
- Do **not** delete `TenantManagementSection` or `EditTenantManagementSection` components — they may still be used by v1 flows.

## What Stays Unchanged

| Area | Status |
|------|--------|
| v1 environment creation flow (`syncv1Environment`) | **Unchanged** — still uses form-provided tenants/ODS |
| `TenantManagementSection` component | **Unchanged** — kept for v1 |
| `updateEnvironment` (edit path) | **Out of scope** for this refactor |
| `refresh-resources` endpoint | **Unchanged** — already correct pattern |
| `SbSyncConsumer` / `AdminApiSyncService` | **Unchanged** — already handles `adminApiUrl` environments |

## Rationale

- The Admin API is the source of truth for tenants, ODS instances, and EdOrgs. Asking users to re-enter this data manually is redundant and error-prone.
- The `refresh-resources` endpoint and `SbSyncConsumer` already implement the correct sync logic. Reusing it for environment creation removes duplicated credential and data sync logic.
- Removing the pre-creation `validateTenantsAndCreateCredentials` step simplifies the create flow and avoids a network call to the Admin API during the create request (it is deferred to the background job).
