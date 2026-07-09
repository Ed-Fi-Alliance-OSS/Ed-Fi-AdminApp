# Admin API V3 Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a V3-aware surface (DTOs, controller, service, exception filter) to the Admin App API's Starting Blocks integration so a tenant running Ed-Fi Admin API V3 can be managed through the Admin App the same way V1/V2 tenants are today.

**Architecture:** Mirror the existing `starting-blocks/v2` module structure into a new `starting-blocks/v3` module: a new `edfi-admin-api.v3.dto.ts` model file, a new `AdminApiControllerV3`/`AdminApiServiceV3` pair scoped to the same ~31 routes the V2 controller implements today (renamed to V3's `dataStore` vocabulary), and a new `AdminApiV3ExceptionFilter` that parses the Admin API V3's RFC 7807 problem-details error shape. Registered as a sibling route (`/admin-api/v3`) alongside V1/V2. No sync/job-queue orchestration, no frontend, no new packages.

**Tech Stack:** NestJS, TypeORM, class-transformer/class-validator, axios, Jest.

## Global Constraints

- No new npm packages/libraries — everything already installed by V1/V2 is reused.
- Must not change existing V1/V2 request/response behavior or routes. Never edit any `v1/` or `v2/` file except where explicitly listed as a small additive change (`services.module.ts`, `starting-blocks/index.ts`, `sb-environments-global.service.ts`).
- V3 mirrors **only the ~31 routes the V2 controller currently implements** (vendors, applications, api clients, claim sets, GET-all data stores, profiles) — not the full 44-route V2 swagger surface, since V2 itself doesn't implement the other 13 (actions, authorizationStrategies, resourceClaims CRUD, dbInstances, ods-instance-context/derivative CRUD, single-data-store GET, tenant edorgs, jobs). This was explicitly confirmed with the user.
- Field/route rename, confirmed against the live V2 and V3 swagger specs (44 paths / 56 schemas, 1:1 match otherwise):
  - `odsInstance` / `odsInstanceId` / `odsInstanceIds` → `dataStore` / `dataStoreId` / `dataStoreIds`
  - `instanceType` → `dataStoreType`
  - Route segment `odsinstances` → `dataStores`
  - Class/type name segment `OdsInstance` → `DataStore` (e.g. `GetOdsInstanceDetailDtoV2` → `GetDataStoreDetailDtoV3`)
- `StartingBlocksServiceV2` and `ISbEnvironmentConfigPrivateV2` are reused as-is for V3 (genuinely version-agnostic shapes) — do **not** rename these two identifiers anywhere in V3 code.
- Excluded from V3 scope entirely (confirmed dead code or AC-526 sync territory, not reachable from any of the 31 mirrored routes): `selfRegisterAdminApi`, `getActions`, `getAuthorizationStrategies`, `getResourceClaims`/`getResourceClaim`, `postClaimsetResourceClaimAction`/`putClaimsetResourceClaimAction`/`postOverrideAuthorizationStrategy`/`resetAuthorizationStrategies`/`deleteClaimsetResourceClaimAction`, `getEdOrgsForOdsInstance`, `postOdsInstance`/`getOdsInstance`/`putOdsInstance`/`deleteOdsInstance` (single-instance CRUD), ODS instance context/derivative CRUD, `getVendorApplications`, `getTenants`, `getAllEdOrgsForTenant`, `getAdminApiClientForEnvironment`/`getAdminApiClientUsingEnv`.
- Test depth mirrors V2 exactly, per user confirmation.

## Phases

This plan is split into 4 phase files, executed in order (each depends on the previous):

1. [`plan-phase1-dtos.md`](./plan-phase1-dtos.md) — `edfi-admin-api.v3.dto.ts` model file.
2. [`plan-phase2-exception-filter.md`](./plan-phase2-exception-filter.md) — `AdminApiV3ExceptionFilter` (RFC 7807 parsing).
3. [`plan-phase3-service.md`](./plan-phase3-service.md) — `AdminApiServiceV3`.
4. [`plan-phase4-controller-and-registration.md`](./plan-phase4-controller-and-registration.md) — `AdminApiControllerV3`, `AdminApiModuleV3`, route/module/global-provider registration, and the `updateAdminApi` credential-saving gap fix.

Each phase file has its own numbered tasks with the standard TDD step structure (failing test → verify fail → implement → verify pass → commit).
