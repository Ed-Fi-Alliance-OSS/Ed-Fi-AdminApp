# ODS Non-StartingBlocks Async Delete Design

## Context

Non-StartingBlocks ODS creation uses asynchronous Admin API `dbInstances` creation: local ODS is persisted immediately with `PendingCreate`, while a background process completes create/delete and sync reconciliation.

We need delete behavior for non-StartingBlocks to follow the same asynchronous pattern.

## Scope

In scope:
- Add Admin API v2 controller endpoint to delete by `dbInstanceId`
- Mark matching local ODS status as `PendingDelete`
- Trigger sync job after delete request is accepted
- Add FE query + action wiring so delete uses `dbInstanceId` for non-StartingBlocks
- Keep StartingBlocks delete behavior unchanged
- Enforce delete eligibility: only records with `dbInstanceId > 0`

Out of scope:
- Changing StartingBlocks delete flow
- Changing create flow
- Synchronous wait for background completion

## Design

### 1) Backend endpoint and orchestration

Add `DELETE dbinstances/:dbInstanceId` in:
- `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.ts`

Flow:
1. Parse and validate `dbInstanceId` (`> 0`).
2. Resolve local ODS for current tenant by `dbInstanceId`.
3. Set local ODS status to `PendingDelete`.
4. Call Admin API v2 delete for that db instance ID.
5. Enqueue `ENV_SYNC_CHNL` job for environment sync.
6. Return success immediately (async model, no blocking on background completion).

### 2) FE query wiring

Update:
- `packages/fe/src/app/api/queries/queries.v7.ts`

Extend `dbInstancesV2` with `delete('delete')` so FE can call:
- `DELETE .../dbinstances/:dbInstanceId`

### 3) FE delete action behavior

Update delete actions in:
- `packages/fe/src/app/Pages/Ods/OdssPage.tsx`
- `packages/fe/src/app/Pages/Ods/useOdsActions.tsx` (used by `OdsPage.tsx`)

Rules:
- If `isStartingBlocks === true`: keep existing `odsQueries.delete` flow unchanged.
- If `isStartingBlocks === false`: use `dbInstancesV2.delete` with `dbInstanceId`.
- Only allow non-StartingBlocks delete for rows where `dbInstanceId > 0`.
  - Non-eligible rows must not expose active delete behavior.

## Error handling

- Invalid `dbInstanceId` (`<= 0`): reject request.
- No matching tenant-owned local ODS by `dbInstanceId`: return not found.
- Admin API delete failure: surface error response; do not claim completion.
- Sync job enqueue must run only after request/record update succeeds.

## Testing strategy

Backend tests:
- New delete endpoint success path:
  - status becomes `PendingDelete`
  - Admin API delete is called with same `dbInstanceId`
  - sync job is queued
- Invalid ID path (`<= 0`)
- Not found path (no ODS for tenant + `dbInstanceId`)
- Admin API failure propagation path

Frontend tests:
- Non-StartingBlocks + `dbInstanceId > 0` uses `dbInstancesV2.delete`
- StartingBlocks behavior still uses `odsQueries.delete`
- Non-eligible non-StartingBlocks rows do not provide active delete action

## Success criteria

1. Non-StartingBlocks delete is asynchronous and keyed by `dbInstanceId`.
2. Local ODS transitions to `PendingDelete` before background reconciliation.
3. Sync job is queued on successful delete request acceptance.
4. StartingBlocks delete remains unchanged.
5. FE only allows non-StartingBlocks delete when `dbInstanceId > 0`.
