# ODS Create Flow: `databaseTemplate` Contract and Fixed Template Options

## Summary

Update the ODS creation flow with environment-gated behavior:
1. `name` (required)
2. Template field behavior depends on `sbEnvironment.startingBlocks`

When `sbEnvironment.startingBlocks === false`, submit payload is:

```json
{
  "name": "My DB Instance",
  "databaseTemplate": "Minimal"
}
```

When `sbEnvironment.startingBlocks === true`, keep current behavior unchanged (existing template selection + payload shape).

After successful creation, the user is redirected to the ODS details page (existing behavior in both modes).

## Scope

In scope:
- ODS create form and payload changes only when `sbEnvironment.startingBlocks === false`
- Explicit preservation of current functionality when `sbEnvironment.startingBlocks === true`
- Shared DTO/service handling needed to support the conditional behavior
- Targeted validation and UI tests for both conditional paths

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

## 1) Contract and Validation Changes (Conditional)

- Keep backward-compatible handling for `templateName` where needed by `startingBlocks === true` flow.
- Add/align support for `databaseTemplate` for `startingBlocks === false` flow.
- Apply updated `name` validation (mixed case letters, numbers, spaces) for the non-starting-blocks flow, preserving existing length limits unless explicitly changed later.

Result: non-starting-blocks flow uses `databaseTemplate`; starting-blocks flow remains unchanged.

## 2) Frontend Form Changes (`CreateOdsPage.tsx`, Conditional)

- If `sbEnvironment.startingBlocks === false`:
  - Use a local required dropdown with exactly `Minimal` and `Sample`.
  - Bind to `databaseTemplate`.
  - Keep `name` as required.
- If `sbEnvironment.startingBlocks === true`:
  - Keep existing behavior unchanged (continue current selector + payload behavior).
- Keep submit/cancel UX and post-success navigation logic unchanged for both paths.

Result: non-starting-blocks path enforces fixed templates and `databaseTemplate`; starting-blocks path is preserved.

## 3) Backend Wiring Changes (Conditional Input Handling)

- Update `packages/api/src/teams/edfi-tenants/odss/odss.service.ts` to handle template value based on existing environment behavior:
  - Preserve current `startingBlocks === true` flow exactly.
  - Support `databaseTemplate` for `startingBlocks === false`.
  - Pass resolved template value into existing `startingBlocksServiceV2.createOds(...)` template argument.
- Keep route/controller behavior stable while supporting both input paths as required by the gate.

Result: backend preserves existing starting-blocks behavior while enabling the new non-starting-blocks payload path.

## Data Flow

1. FE evaluates `sbEnvironment.startingBlocks`.
2. If `false`: user selects `Minimal`/`Sample`; FE submits `{ name, databaseTemplate }`.
3. If `true`: FE follows existing template selection and payload behavior unchanged.
4. API binds input and resolves template value according to path.
5. Service calls create operation with resolved template.
6. Success returns created ODS ID.
7. FE redirects to ODS details page using existing path logic.

## Error Handling

- Field validation errors remain form-level via `react-hook-form` + existing resolver.
- API validation/business errors continue through `mutationErrCallback` and existing banner/root patterns.
- Duplicate name behavior remains mapped to `name` field error in backend validation flow.
- Conditional branch selection errors (if any) should fail explicitly, not silently fallback to the wrong path.

## Testing Strategy

- Update or add targeted model/DTO validation tests:
  - non-starting-blocks path: `databaseTemplate` required
  - starting-blocks path: existing template field behavior preserved
  - `name` validation update for the non-starting-blocks path
- Update or add focused FE test coverage for create ODS page:
  - `startingBlocks === false`: dropdown options exactly `Minimal` and `Sample`, payload uses `databaseTemplate`
  - `startingBlocks === true`: existing selector/payload behavior unchanged
  - Success path still navigates to details page in both branches
- Keep test scope targeted to changed behavior only.

## Risks and Mitigations

- Risk: Regressing existing starting-blocks flow while adding non-starting-blocks behavior.
  - Mitigation: explicit branch-gated logic and tests that assert no behavior drift when `startingBlocks === true`.
- Risk: Name validation mismatch between user expectation and backend rules.
  - Mitigation: apply agreed validation only where intended and verify via tests.

## Alternatives Considered

1. FE-only adaptation while retaining `templateName` internally.
   - Rejected: contract inconsistency and future maintenance cost.
2. Dual-field backend compatibility (`templateName` + `databaseTemplate`).
   - Rejected: extra complexity not needed for this scoped change.

Selected approach: branch-gated update—new `databaseTemplate` behavior for `startingBlocks === false`, preservation of current behavior for `startingBlocks === true`.

## Acceptance Criteria

- When `sbEnvironment.startingBlocks === false`:
  - form shows required name input
  - required template dropdown with only `Minimal` and `Sample`
  - POST payload uses `databaseTemplate`
- When `sbEnvironment.startingBlocks === true`:
  - existing create ODS UI and payload behavior remain unchanged
- ODS creation success redirects to details page.
- ODS list/details pages continue to work unchanged.
