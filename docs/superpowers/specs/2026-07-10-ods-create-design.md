# ODS Create Flow: `databaseTemplate` Contract and Fixed Template Options

## Summary

Update the ODS creation flow so users enter:
1. `name` (required)
2. `databaseTemplate` (required dropdown with exactly `Minimal` and `Sample`)

On submit, the frontend sends:

```json
{
  "name": "My DB Instance",
  "databaseTemplate": "Minimal"
}
```

After successful creation, the user is redirected to the ODS details page (existing behavior).

## Scope

In scope:
- ODS create form behavior and payload shape
- Shared create DTO/contract field name alignment (`templateName` -> `databaseTemplate`)
- Backend ODS create service wiring to use the new DTO field
- Targeted validation and UI tests for changed behavior

Out of scope:
- ODS list/details functionality
- ODS deletion or update flows
- Starting Blocks API contract changes

## Current Context

- `CreateOdsPage.tsx` currently binds template selection to `templateName` and uses `SelectOdsTemplate`.
- Shared `PostOdsDto` currently defines `templateName`.
- Backend `odss.service.ts` currently passes `dto.templateName` into `startingBlocksServiceV2.createOds(...)`.
- List/details pages already work and should remain unchanged.

## Design

## 1) Contract and Validation Changes

- Update `PostOdsDto` in `packages/models/src/dtos/ods.dto.ts`:
  - Replace `templateName` with `databaseTemplate`.
  - Keep `databaseTemplate` required.
  - Update `name` validation to allow mixed case letters, numbers, and spaces (required), while preserving existing length limits unless explicitly changed later.

Result: FE form state, payload, and backend DTO binding share the same `databaseTemplate` field name.

## 2) Frontend Form Changes (`CreateOdsPage.tsx`)

- Replace dynamic `SelectOdsTemplate` usage in this page with a local required dropdown that contains exactly:
  - `Minimal`
  - `Sample`
- Bind dropdown to `databaseTemplate`.
- Keep `name` as required.
- Keep submit/cancel UX and post-success navigation logic unchanged.

Result: Users can only choose approved templates, and request payload matches required key.

## 3) Backend Wiring Changes

- Update `packages/api/src/teams/edfi-tenants/odss/odss.service.ts` so ODS create uses:
  - `dto.databaseTemplate`
  - passed into existing `startingBlocksServiceV2.createOds(...)` template argument
- No route or controller signature changes beyond DTO property alignment.

Result: backend continues current create flow, now sourced from `databaseTemplate`.

## Data Flow

1. User fills `name` and selects template (`Minimal` or `Sample`).
2. FE validation ensures both fields are present and name format is valid.
3. FE sends POST body with `{ name, databaseTemplate }`.
4. API controller binds to updated `PostOdsDto`.
5. Service calls Starting Blocks create operation with selected template.
6. Success returns created ODS ID.
7. FE redirects to ODS details page using existing path logic.

## Error Handling

- Field validation errors remain form-level via `react-hook-form` + existing resolver.
- API validation/business errors continue through `mutationErrCallback` and existing banner/root patterns.
- Duplicate name behavior remains mapped to `name` field error in backend validation flow.

## Testing Strategy

- Update or add targeted model/DTO validation tests:
  - `databaseTemplate` required
  - `name` accepts mixed case alphanumeric with spaces
- Update or add focused FE test coverage for create ODS page:
  - Dropdown options are exactly `Minimal` and `Sample`
  - Submit payload uses `databaseTemplate` (not `templateName`)
  - Success path still navigates to details page
- Keep test scope targeted to changed behavior only.

## Risks and Mitigations

- Risk: Existing code still references `templateName`.
  - Mitigation: repo-wide update for create-path usages tied to `PostOdsDto`.
- Risk: Name validation mismatch between user expectation and backend rules.
  - Mitigation: align regex and error message with approved requirement (letters/numbers/spaces, mixed case).

## Alternatives Considered

1. FE-only adaptation while retaining `templateName` internally.
   - Rejected: contract inconsistency and future maintenance cost.
2. Dual-field backend compatibility (`templateName` + `databaseTemplate`).
   - Rejected: extra complexity not needed for this scoped change.

Selected approach: strict alignment on `databaseTemplate` end-to-end for create flow.

## Acceptance Criteria

- Create ODS form shows:
  - required name input
  - required template dropdown with only `Minimal` and `Sample`
- POST payload uses `databaseTemplate`.
- ODS creation success redirects to details page.
- ODS list/details pages continue to work unchanged.
