# V3 Environment Sync Support (AC-526) — Implementation Plan Overview

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan phase-by-phase, file
> by file. Steps use checkbox (`- [ ]`) syntax for tracking. Each phase file under this
> folder is self-contained (files/interfaces/steps/tests) and can be handed to a fresh
> worker with only that file plus this overview.

**Goal:** Make V3 Admin API environments create, update, and synchronize (tenants/ODS
instances/education organizations) exactly the way V2 environments already do, by
replacing scattered `version === 'v1'/'v2'` checks in `SbEnvironmentsEdFiService` and
`AdminApiSyncService` with an explicit `AdminApiVersionStrategy` abstraction.

Full requirements/rationale: [526-design.md](./526-design.md). Related scaffolding:
[524-design.md](./524-design.md) (AC-524, V3 Admin API client/DTOs — already done).

**Architecture:** Introduce `AdminApiVersionStrategy` (interface) with
`V1AdminApiVersionStrategy` / `V2AdminApiVersionStrategy` / `V3AdminApiVersionStrategy`
implementations and an `AdminApiVersionStrategyFactory` that resolves a version string to
the right strategy instance. `V3AdminApiVersionStrategy` extends
`V2AdminApiVersionStrategy`, overriding only the two methods where V3 actually differs
(`getAdminApiService()`, `buildConfigPublic()`). `SbEnvironmentsEdFiService` and
`AdminApiSyncService` inject the factory instead of the concrete `AdminApiService*`
classes and version-specific booleans.

**Tech Stack:** NestJS (TypeScript), TypeORM, Jest. No new npm packages.

## Global Constraints

(Apply to every phase below — do not repeat, but do not violate.)

- New npm packages: not permitted — implement with already-installed dependencies only.
- Must not change observable V1 or V2 behavior in any way (existing V1/V2 tests must
  keep passing unmodified in their assertions; only call-site plumbing changes).
- Must not introduce a new V3-specific database schema — V3 data uses the existing
  `EdfiTenant`/`Ods`/`Edorg` tables shared with V1/V2.
- All new/changed code lives in `packages/api/src/**`; no frontend changes (out of scope
  per design doc, covered by AC-527–530).

## File Structure

New folder `packages/api/src/admin-api-version-strategy/`:

- `admin-api-version-strategy.interface.ts` — the `AdminApiVersionStrategy` interface and
  shared types (`BuildConfigPublicInput`, `DispatchSyncResult`). (Phase 1)
- `v1-admin-api-version.strategy.ts` / `.spec.ts` (Phase 1)
- `v2-admin-api-version.strategy.ts` / `.spec.ts` (Phase 2)
- `v3-admin-api-version.strategy.ts` / `.spec.ts` (Phase 3)
- `admin-api-version-strategy.factory.ts` / `.spec.ts` + `index.ts` (Phase 3)

Modified files:

- `packages/api/src/sb-environments-global/sb-environments-edfi.services.ts` — `create()`
  (Phase 4) and `updateEnvironment()` (Phase 5) delegate to the factory/strategy instead
  of inline `version === 'v1'/'v2'` branches.
- `packages/api/src/sb-sync/edfi/adminapi-sync.service.ts` — `syncEnvironmentData()` and
  `syncTenantData()` delegate to the factory/strategy (Phase 6); the now-redundant
  private methods (`bootstrapEnvironmentCredentials`, `provisionCredentialsForNewTenants`,
  their private `createClientCredentials`) are deleted, their logic having moved into
  `V2AdminApiVersionStrategy` in Phase 2.
- `packages/api/src/app/services.module.ts` — register the three strategy providers and
  the factory (Phase 3).
- Existing/new spec files for the two services above — adapted to inject/mock the
  factory instead of the concrete Admin API services directly (Phases 4–6).

## Phases

Work through these in order — later phases depend on earlier ones:

1. **[526-plan-01-strategy-core.md](./526-plan-01-strategy-core.md)** — `AdminApiVersionStrategy`
   interface + `V1AdminApiVersionStrategy`.
2. **[526-plan-02-strategy-v2.md](./526-plan-02-strategy-v2.md)** — `V2AdminApiVersionStrategy`
   (the largest single unit — absorbs credential bootstrap/provisioning logic).
3. **[526-plan-03-strategy-v3-and-factory.md](./526-plan-03-strategy-v3-and-factory.md)** —
   `V3AdminApiVersionStrategy` (extends V2) + `AdminApiVersionStrategyFactory` + DI
   registration in `services.module.ts`.
4. **[526-plan-04-wire-create.md](./526-plan-04-wire-create.md)** — wire the factory into
   `SbEnvironmentsEdFiService.create()`.
5. **[526-plan-05-wire-update.md](./526-plan-05-wire-update.md)** — wire the factory into
   `SbEnvironmentsEdFiService.updateEnvironment()`.
6. **[526-plan-06-wire-sync.md](./526-plan-06-wire-sync.md)** — wire the factory into
   `AdminApiSyncService.syncEnvironmentData()` / `syncTenantData()`, including the V3
   route-shape differences (`dataStores` vs `odsInstances`).
7. **[526-plan-07-verification.md](./526-plan-07-verification.md)** — full regression
   pass (test/lint/typecheck) and design success-criteria checklist.
