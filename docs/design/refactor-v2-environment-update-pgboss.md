# Refactor v2 Environment Update: Remove Tenant/ODS/EdOrg Form Fields & Delegate to pg_boss

## Overview

This document extends the refactor described in
[refactor-v2-environment-creation-pgboss.md](./refactor-v2-environment-creation-pgboss.md) to
cover the **update** (`PUT /sb-environments/:id`) flow.  The same motivations apply: the Admin
API is the source of truth for tenants, ODS instances, and EdOrgs.  Asking the user to re-enter
or manually maintain that data during an edit is redundant and error-prone.

### Constraints

1. Changing from v1 to v2 (or vice-versa) is **not allowed** — already enforced by the frontend
   and validated by the backend.
2. Changing from single-tenant to multi-tenant (or vice-versa) is **not allowed** — already
   enforced by the existing `isMultitenant` guard in `updateEnvironment`.
3. The pg_boss sync **must run on every v2 update**, even name-only changes.  Tenants, ODS
   instances, or EdOrgs may have been added, edited, or deleted directly in the Admin API since
   the last sync.

---

## Problem

The existing v2 Ed-Fi environment update flow still treats tenants, ODS instances, and
education organizations as user-editable request data.

That no longer matches the source-of-truth model established by the v2 create refactor:

1. The Admin API already exposes tenant, ODS, and EdOrg data.
2. The existing background sync mechanism already knows how to discover and persist that data.
3. The current update flow duplicates credential validation and resource persistence inline
   during the HTTP request.

As a result, v2 update still has two competing sources of truth — user-submitted form data and
the Admin API — which should be reduced to one: the Admin API via `ENV_SYNC_CHNL`.

## Goals

- Remove tenant, ODS, and EdOrg input fields from the v2 environment edit form.
- After saving the environment record, enqueue a pg_boss background job (`ENV_SYNC_CHNL`) to
  fetch tenants/ODS/EdOrgs from the Admin API automatically.
- Mirror the pattern already used by `PUT /sb-environments/:id/refresh-resources` and the
  v2 create flow.
- Keep all v1 update behavior unchanged.

---

## Current Flow (v2 Update)

```
PUT /sb-environments/:id
  → SbEnvironmentsGlobalController.update()
      hasTenantUpdates || hasUrlUpdates?
        YES → SbEnvironmentsEdFiService.updateEnvironment()
                  → findOne() with relations
                  → validateAdminApiUrl()                    ← if adminApiUrl provided
                  → validateTenantsAndCreateCredentials()    ← v2 multi-tenant + URL change
                  → createClientCredentials()               ← v2 single-tenant + URL change
                    startingBlocksServiceV2.saveAdminApiCredentials()
                  → sbEnvironmentsRepository.save()         ← name / URLs / envLabel
                  → updateEnvironmentTenants()              ← manual tenant/ODS sync from form
                  → findOne() reload with relations
                  → return environment
              → createDetailedEnvironmentResponse(updatedEnvironment)
        NO  → sbEnvironmentService.update()                 ← name-only, no sync at all
              toGetSbEnvironmentDto(...)
```

### Problems with the Current Flow

- `validateTenantsAndCreateCredentials` makes a per-tenant network call to the Admin API
  inline during the HTTP request — the same pattern removed from `create` in the previous
  refactor.
- Credential recreation for v2 environments during URL changes duplicates logic already
  handled by `SbSyncConsumer.bootstrapEnvironmentCredentials` when the pg_boss job runs.
- `updateEnvironmentTenants` / `updateExistingTenant` / `createNewTenant` duplicate the sync
  logic that `AdminApiSyncService` already performs correctly in the background.
- Name-only v2 updates bypass the background sync entirely, so tenant/ODS/EdOrg changes made
  directly in the Admin API are never picked up unless the user manually triggers
  `refresh-resources`.

---

## Proposed Flow (v2 Update)

```
PUT /sb-environments/:id
  → SbEnvironmentsGlobalController.update()           ← routing simplified: always uses service
      → SbEnvironmentsEdFiService.updateEnvironment()
            → findOne() with relations
            → validateAdminApiUrl()                   ← if adminApiUrl provided (unchanged)
            → validate version / tenant-mode immutability (unchanged)
            → sbEnvironmentsRepository.save()        ← name / URLs / envLabel (unchanged)
            → isV2Environment?
                YES → syncv2Environment(savedEnvironment)   ← reuse existing method
                          → boss.send(ENV_SYNC_CHNL, { sbEnvironmentId }, { expireInHours: 2 })
                          → poll SbSyncQueue until done or timeout (same as create)
                      → findOne() reload with relations
                      → return environment
                NO  → updateEnvironmentTenants() if tenants provided (v1 path, unchanged)
                      → findOne() reload with relations
                      → return environment
          → createDetailedEnvironmentResponse(updatedEnvironment)
```

`SbSyncConsumer.refreshSbEnvironment()` already routes Admin API-backed environments through
`AdminApiSyncService.syncEnvironmentData()`, which:

1. Discovers tenants from the Admin API.
2. Provisions Admin API credentials for newly discovered tenants (`bootstrapEnvironmentCredentials`).
3. Syncs ODS instances and EdOrgs per tenant.

---

## Changes Required

### Backend — `packages/api`

#### `sb-environments-global/sb-environments-edfi.services.ts`

**In `updateEnvironment`:**

1. **Remove** the `validateTenantsAndCreateCredentials` call and the surrounding
   `if (hasUrlUpdates && isV2Environment && isCurrentlyMultiTenant)` block.
2. **Remove** the v2 single-tenant credential-recreation block — the
   `if (hasUrlUpdates && updateDto.adminApiUrl && !isCurrentlyMultiTenant)` branch that calls
   `startingBlocksServiceV2.saveAdminApiCredentials`. Keep the **v1** credential-recreation
   branch unchanged (it calls `startingBlocksServiceV1.saveAdminApiCredentials`).
3. **Remove** the `const validationDto: PostSbEnvironmentDto = { ... }` temporary DTO that was
   built only for credential validation.
4. **After** `sbEnvironmentsRepository.save(updatedProperties)`, replace the existing
   `updateEnvironmentTenants` call with version-specific logic:
   - For `isV2Environment`: call `await this.syncv2Environment(updatedEnvironment)` (reusing
     the same method already added for `create`).
   - For v1: call `this.updateEnvironmentTenants(updatedEnvironment, updateDto.tenants)` only
     when `updateDto.tenants` is provided (unchanged behavior).

**Delete now-unused private method:**

| Method | Reason |
|--------|--------|
| `validateTenantsAndCreateCredentials` | Was already not called from `create`. Now also not called from `update`. No remaining callers — **delete it**. |

> **Keep** `updateEnvironmentTenants`, `updateExistingTenant`, `createNewTenant`, `removeTenant`,
> and `removeAllOdsForTenant` — still used by the **v1 update** path.

> **Keep** `createClientCredentials` — still used by the **v1** credential-recreation branch.

> **Keep** `createODSObject`, `createODSObjectV1`, `saveSyncableOds`, `saveSyncableOdsV1` —
> still used by the v1 update path through `updateEnvironmentTenants`.

> **Keep** `syncv2Environment` — now shared by both `create` and `update`.

#### `sb-environments-global/sb-environments-global.controller.ts`

**In `update`:**

Remove the `hasTenantUpdates / hasUrlUpdates` routing condition and the `else` branch that
routes name-only updates to `sbEnvironmentService.update()`. Always call
`sbEnvironmentEdFiService.updateEnvironment()`. This ensures every v2 update — including
name-only changes — triggers the background sync, which is required by constraint 3 above.

```typescript
// Before
async update(...) {
  const hasTenantUpdates = updateSbEnvironmentDto.tenants && updateSbEnvironmentDto.tenants.length > 0;
  const hasUrlUpdates = updateSbEnvironmentDto.odsApiDiscoveryUrl || updateSbEnvironmentDto.adminApiUrl
    || updateSbEnvironmentDto.environmentLabel || updateSbEnvironmentDto.isMultitenant !== undefined;

  if (hasTenantUpdates || hasUrlUpdates) {
    const updatedEnvironment = await this.sbEnvironmentEdFiService.updateEnvironment(
      sbEnvironmentId, updateSbEnvironmentDto, user
    );
    return this.createDetailedEnvironmentResponse(updatedEnvironment);
  } else {
    return toGetSbEnvironmentDto(
      await this.sbEnvironmentService.update(sbEnvironmentId, addUserModifying(updateSbEnvironmentDto, user))
    );
  }
}

// After
async update(...) {
  const updatedEnvironment = await this.sbEnvironmentEdFiService.updateEnvironment(
    sbEnvironmentId,
    updateSbEnvironmentDto,
    user
  );
  return this.createDetailedEnvironmentResponse(updatedEnvironment);
}
```

The response shape does not change: `createDetailedEnvironmentResponse(updatedEnvironment)` is
still returned.  The frontend reads `result.id` to navigate to the detail page — this is
unaffected.

#### `sb-sync.consumer.ts` and `adminapi-sync.service.ts`

No changes required. These already handle v2 environments correctly.

---

### Frontend — `packages/fe`

#### `Pages/SbEnvironmentGlobal/EditSbEnvironmentGlobalPage.tsx`

Mirror what was done in `CreateSbEnvironmentGlobalPage` for the create flow.

**1. Remove `EditTenantManagementSection` for v2 environments.**

The condition that renders the section is:

```tsx
// Before
{(currentVersion === 'v1' || currentVersion === 'v2') && (
  <Box mb={4}>
    <EditTenantManagementSection ... />
  </Box>
)}

// After
{currentVersion === 'v1' && (
  <Box mb={4}>
    <EditTenantManagementSection ... />
  </Box>
)}
```

**2. Remove v2 tenant/ODS validation from `validateForm()`.**

```typescript
// Before: validates both v1 and v2
if (currentVersion === 'v1') {
  if (!validateFirstTenantHasOds(data.tenants)) { ... }
} else if (currentVersion === 'v2') {
  if (data.isMultitenant && !validateTenantsExist(data.tenants)) { ... }
  if (!data.isMultitenant && !validateFirstTenantHasOds(data.tenants)) { ... }
}

if (currentVersion === 'v1' || currentVersion === 'v2') {
  data.tenants?.forEach((tenant, tenantIndex) => { /* per-tenant/ODS validation */ });
}

// After: v2 blocks removed entirely
if (currentVersion === 'v1') {
  if (!validateFirstTenantHasOds(data.tenants)) { ... }
  data.tenants?.forEach((tenant, tenantIndex) => { /* per-tenant/ODS validation */ });
}
```

**3. Remove `tenants` population from `transformEnvironmentToFormData` for v2 environments.**

For v2, the `tenants` array does not need to be seeded into the form because the field is no
longer displayed or submitted.  The `tenants` field in `PutSbEnvironmentDto` can remain in
the DTO for v1 compatibility but should not be populated for v2 form state.

**4. Keep `EditTenantManagementSection` component** — do not delete it; it is still used for
v1 environments.

**5. No change to the `onSubmit` handler or the `putSbEnvironment` mutation call.** The backend
response still includes `id` so `navigate(\`/sb-environments/${result.id}\`)` works unchanged.

---

## Sequence Diagram — Proposed v2 Update Flow

```
Client          Controller              Service (updateEnvironment)      SbSyncConsumer
  |                  |                          |                              |
  | PUT /sb-env/:id  |                          |                              |
  |----------------->|                          |                              |
  |                  | updateEnvironment(id,dto)|                              |
  |                  |------------------------->|                              |
  |                  |                          | findOne(id, relations)       |
  |                  |                          | validateAdminApiUrl() *if*   |
  |                  |                          | save(updatedProperties)      |
  |                  |                          | boss.send(ENV_SYNC_CHNL)     |
  |                  |                          |----------------------------->|
  |                  |                          | poll SbSyncQueue (≤10s)      |
  |                  |                          |<-- completed / timeout       |
  |                  |                          | findOne(id, relations)       |
  |                  |    environment           |                              |
  |                  |<-------------------------|                              |
  |                  | createDetailedResponse() |                              |
  |  HTTP 200 + env  |                          |                              |
  |<-----------------|                          |                              |
```

---

## What Stays Unchanged

| Area | Status |
|------|--------|
| v1 environment update flow (manual tenant/ODS sync) | **Unchanged** |
| v1 credential recreation when `adminApiUrl` changes | **Unchanged** |
| `EditTenantManagementSection` component | **Unchanged** — kept for v1 |
| Version and tenant-mode immutability rules | **Unchanged** |
| `refresh-resources` endpoint | **Unchanged** |
| `SbSyncConsumer` / `AdminApiSyncService` / `bootstrapEnvironmentCredentials` | **Unchanged** |
| `PutSbEnvironmentDto` model | **Unchanged** — `tenants` field kept for v1 |

---

## Rationale

- Mirrors the same reasoning as the create refactor: the Admin API is the source of truth and
  the background consumer already implements the correct sync logic.
- Eliminates pre-save network round trips to the Admin API (per-tenant credential validation).
- Guarantees tenant/ODS/EdOrg data is always refreshed on every v2 edit — including name-only
  updates — satisfying the requirement that changes made directly in the Admin API are always
  picked up.
- Reuses `syncv2Environment`, which was already extracted for the create path, keeping both
  flows consistent and reducing duplication.

---

## Verification Plan

### Backend

1. Update a v2 single-tenant environment **name only** → confirm `ENV_SYNC_CHNL` job is enqueued.
2. Update a v2 environment **label only** → confirm `ENV_SYNC_CHNL` job is enqueued.
3. Update a v2 environment **ODS API Discovery URL** (same version, same tenant mode) → confirm
   URL is persisted and `ENV_SYNC_CHNL` job is enqueued.
4. Update a v2 environment **Management API URL** → confirm URL is persisted and
   `ENV_SYNC_CHNL` job is enqueued.
5. Confirm no inline call to `validateTenantsAndCreateCredentials` for v2 updates.
6. Confirm no inline credential recreation via `startingBlocksServiceV2.saveAdminApiCredentials`
   for v2 updates.
7. Attempt to change version (e.g. v2 → v1 URL) → confirm rejection.
8. Attempt to change tenant mode → confirm rejection.

### Frontend

1. Open edit form for a v2 environment → confirm `EditTenantManagementSection` is **not** rendered.
2. Open edit form for a v1 environment → confirm `EditTenantManagementSection` **is** rendered.
3. Submit v2 edit with only name/URL changes → confirm success banner and navigation.
4. Submit v1 edit → confirm tenant/ODS validation still fires.

### Regression

1. Confirm v1 edit still requires tenant and ODS input.
2. Confirm v1 update still persists tenant/ODS changes synchronously.
3. Confirm Starting Blocks environment edit behavior is unchanged.

   Recommended: return the async DTO whenever the v2 Admin API-backed update path is used.

2. Should `PutSbEnvironmentDto.tenants` remain in the shared DTO?

   Recommended: yes, for minimal scope. Ignore it for v2, keep it for v1.

3. Should simple v2 name-only edits still enqueue sync?

   Recommended: no, unless the implementation determines the update changed fields that affect Admin API-derived resource synchronization.

4. Should backend Phase 1 ship before any frontend updates?

  Recommended: yes. Backend can be delivered first as long as response compatibility is maintained for current clients.

## Rationale

This design completes the architectural shift started by the v2 create refactor.

For v2 Admin API-backed environments, Admin App should own environment metadata while the Admin API remains the source of truth for tenants, ODS instances, and EdOrgs.

Reusing the existing pg_boss environment sync path for update:

- removes duplicate orchestration logic
- removes redundant manual v2 form input
- avoids inline network-heavy update work
- keeps create, update, and refresh-resources behavior aligned