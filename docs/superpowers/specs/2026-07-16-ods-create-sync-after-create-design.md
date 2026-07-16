# ODS Create Flow: Create, Refresh Ed-Orgs, Redirect to List

## Context

`CreateOdsPage.tsx` currently creates an ODS/DB instance and redirects to the ODS details page. For non-startingBlocks environments, creation now uses Admin API v2 `dbinstances`.

## Goal

For non-startingBlocks environments, update the create flow to:

1. Send create request and wait for response.
2. Send EdOrgs refresh request and wait for response.
3. Redirect to ODS list page.

StartingBlocks behavior remains unchanged.

## Scope

### In scope

- Frontend flow changes in `packages/fe/src/app/Pages/Ods/CreateOdsPage.tsx`.
- Reuse existing tenant-level EdOrg refresh mutation from `queries.ts` (`edorgQueries.syncEdOrgs`).
- Update focused FE tests in `CreateOdsPage.spec.tsx`.

### Out of scope

- Backend API contract changes.
- StartingBlocks create flow changes.

## Design

### Runtime behavior

- **startingBlocks = true**: Keep current flow (`postOds`) and existing redirect behavior.
- **startingBlocks = false**:
  1. Call `postDbInstance.mutateAsync({ entity: { name, databaseTemplate } })`.
  2. Await tenant-level EdOrg refresh via `edorgQueries.syncEdOrgs(...).mutateAsync({ entity: {} })`.
  3. Navigate to `parentPath` (ODS list), not details.

This uses the refresh endpoint equivalent to `/odsInstances/edOrgs/refresh` (no instance id in path), not `/odsInstances/{instanceId}/edOrgs/refresh`.

### Error handling

- Keep existing mutation error handling via `mutationErrCallback`.
- If create fails, do not call refresh.
- If refresh fails, do not redirect.
- Redirect only when both calls succeed.

### Query invalidation and UX

- EdOrg refresh mutation invalidates EdOrg query keys as currently defined.
- No new UI controls are introduced; this is a submit flow change only.

## Testing

Update `CreateOdsPage.spec.tsx` to verify:

1. Non-startingBlocks flow calls `dbInstancesV2.post` first.
2. Non-startingBlocks flow then calls `edorgQueries.syncEdOrgs` with `{ entity: {} }`.
3. Non-startingBlocks flow redirects to list (`parentPath`), not details.
4. StartingBlocks flow remains unchanged.
