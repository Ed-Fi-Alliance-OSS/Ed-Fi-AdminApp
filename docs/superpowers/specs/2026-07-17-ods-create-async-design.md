# ODS Create Async Completion Design

Date: 2026-07-17
Scope: Non-StartingBlocks ODS creation flow (`CreateOdsPage` + Admin API v2 dbInstance create endpoint)

## Problem

For non-StartingBlocks environments, ODS creation is asynchronous in Admin API and returns `202`.
After this accepted response, Admin App must:

1. Create a local ODS record immediately.
2. Enqueue a sync job to hydrate ODS/EdOrg data from Admin API.

The create page should redirect users to the ODS list page after successful submission.

## Goals

- Keep one FE submit action for non-StartingBlocks create.
- Ensure local ODS row exists right after accepted Admin API create.
- Trigger the same environment sync channel used by environment-level refresh/create flows.
- Preserve existing validation/error handling patterns.
- Redirect to ODS list (not detail page) after successful non-StartingBlocks create.

## Non-Goals

- Changing StartingBlocks ODS create behavior.
- Adding polling UX for async provisioning completion on the create page.
- Refactoring unrelated ODS query/mutation infrastructure.

## Approach (Selected)

Extend backend `postDbInstance` handling so one API call performs orchestration:

1. Call Admin API dbInstances create endpoint.
2. Parse returned dbInstance/ODS instance ID from `Location` header.
3. Insert local `Ods` row with:
   - `edfiTenantId`: current tenant
   - `sbEnvironmentId`: tenant environment
   - `odsInstanceId`: parsed Admin API id
   - `dbName`: user-provided `name`
   - `odsInstanceName`: user-provided `name`
   - `databaseTemplate`: user-provided `databaseTemplate`
   - `status`: `PendingCreate`
4. Enqueue `ENV_SYNC_CHNL` job with `{ sbEnvironmentId }`.
5. Return local ODS identity payload to FE.

Frontend keeps calling this endpoint and, on success, redirects to parent ODS list path.

## Data Flow

1. User submits non-SB create form (`name`, `databaseTemplate`).
2. FE calls `dbInstancesV2.post`.
3. API accepts async create via Admin API (`202` + `Location`).
4. API writes local ODS row in Admin App DB.
5. API enqueues environment sync job.
6. API responds success to FE.
7. FE navigates to ODS list page.
8. Background sync hydrates ODS/EdOrg state and updates status/details.

## Error Handling

- Preserve current validation mapping for `name` and `databaseTemplate`.
- If Admin API create fails, return mapped validation/custom errors as today.
- If local insert fails or sync enqueue fails after accepted Admin API call, return server error (no silent success-shaped fallback).
- FE continues using existing mutation error callback to surface field/global errors.

## Testing Strategy

### Backend

- Add/adjust controller/service tests to verify:
  - Successful `postDbInstance` performs local ODS insert.
  - Inserted row includes `status = PendingCreate` and expected mapped fields.
  - `ENV_SYNC_CHNL` enqueue called with environment id.
  - Response includes local ODS identity payload.

### Frontend

- Update `CreateOdsPage.spec.tsx` non-SB case to assert success redirects to parent list path.
- Preserve existing assertion that non-SB path uses `dbInstancesV2.post`.
- Keep SB create test unchanged.

## Rollout/Compatibility Notes

- API response shape for `dbInstancesV2.post` may expand to include local ODS identity; FE will rely on success semantics and list redirect.
- Existing consumers expecting only Admin API id should be reviewed; this endpoint is currently used by ODS create page scope.
