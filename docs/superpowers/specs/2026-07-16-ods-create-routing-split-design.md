# ODS Create Routing Split Design (StartingBlocks vs Non-StartingBlocks)

## Summary

Split ODS creation routing by environment mode:

- `startingBlocks === true`: keep current ODS create flow through `odss` controller/service.
- `startingBlocks === false`: route creation through a new Admin API v2 endpoint in this app:
  - `POST .../admin-api/v2/dbinstances`
  - payload: `{ "name": "My DB Instance", "databaseTemplate": "Minimal" }`
  - response: `{ "id": <number> }`

## Goals

1. Confirm and preserve existing startingBlocks behavior.
2. Move non-startingBlocks create logic to Admin API v2 controller/service.
3. Remove non-startingBlocks handling from `odss.service.ts`.
4. Keep FE UX unchanged except routing target and payload path selection.

## Scope

In scope:
- New Admin API v2 create-dbinstance endpoint in app API.
- Admin API v2 service method to call upstream `dbInstances`.
- FE split routing in ODS create page.
- Tests in:
  - `admin-api.v2.controller.spec.ts`
  - `admin-api.v2.service.spec.ts`
- Rollback in `odss.service.ts` to startingBlocks-only template behavior.

Out of scope:
- ODS list/details page behavior changes.
- New broad refactors in unrelated API/FE modules.

## Current State (Confirmed)

- ODS create page currently posts via `odsQueries.post`.
- `odsQueries.post` routes to `odss.controller.ts` `@Post()`.
- `odss.service.ts` currently includes non-startingBlocks template branching from prior change.

## Design

### 1) Backend: Admin API v2 Controller Endpoint

Add `@Post('dbinstances')` to `AdminApiControllerV2`:

- Authorization: `team.sb-environment.edfi-tenant:create-ods`
- Input DTO shape: `name` + `databaseTemplate`
- Calls `AdminApiServiceV2.postDbInstance(edfiTenant, payload)`
- Returns `{ id }`
- Error handling follows existing v2 controller patterns:
  - map known validation failures to `ValidationHttpException`
  - generic API failures to `CustomHttpException` or rethrow pattern already used

### 2) Backend: Admin API v2 Service Method

Add `postDbInstance` in `AdminApiServiceV2`:

- Calls upstream Admin API v2: `POST dbInstances`
- Sends payload `{ name, databaseTemplate }`
- Reads `headers.location`
- Extracts numeric id and returns `{ id }`

### 3) Backend: Rollback ODS Service

In `odss.service.ts`:

- Restore `create()` to startingBlocks-oriented handling only.
- Remove non-startingBlocks `databaseTemplate` branching added previously.
- Keep existing duplicate-name and failure behavior as before for this path.

### 4) Frontend: Routing Split in ODS Create

In `CreateOdsPage.tsx` (and query definitions):

- If `startingBlocks === true`:
  - keep existing mutation path (`odsQueries.post`)
- If `startingBlocks === false`:
  - call new Admin API v2 query endpoint (`dbinstances`)
  - submit `{ name, databaseTemplate }`
  - use returned `{ id }` for redirect to details page

## Data Flow

### Non-startingBlocks

1. User submits name + template.
2. FE posts to `.../admin-api/v2/dbinstances`.
3. Controller delegates to v2 service.
4. Service posts to upstream `dbInstances`.
5. Service returns `{ id }`.
6. FE redirects to ODS details route with id.

### StartingBlocks

1. User submits using existing template behavior.
2. FE posts to `.../odss`.
3. Existing `odss` create path handles request (unchanged intent).

## Error Handling

- Validation errors should map to field-level messages (`name`, `databaseTemplate`) where possible.
- Non-validation upstream failures continue through existing error handling conventions.
- No silent fallback behavior for malformed input.

## Testing Strategy

Add tests for new endpoint and service method:

1. `admin-api.v2.controller.spec.ts`
   - success path delegates and returns `{ id }`
   - validation mapping path(s) for common create errors
2. `admin-api.v2.service.spec.ts`
   - posts to `dbInstances` with expected payload
   - extracts id from location header
   - throws/propagates on upstream error

Validate with targeted tests plus repository build.

## Acceptance Criteria

1. ODS create currently still confirmed routed through `odss.controller` for startingBlocks flow.
2. Non-startingBlocks ODS create is routed to `admin-api/v2/dbinstances` endpoint.
3. Non-startingBlocks request payload is `{ name, databaseTemplate }`.
4. Endpoint returns `{ id }` and FE redirect works.
5. `odss.service.ts` no longer contains non-startingBlocks create branching.
6. Added tests in specified controller/service spec files pass.
