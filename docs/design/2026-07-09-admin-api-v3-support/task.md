# Admin API V3 Support

## Problem Statement

The Admin App API currently only knows how to communicate with Ed-Fi Admin API V1 and V2. Ed-Fi tenants running the newer Admin API V3 specification cannot be onboarded or managed through the Admin App, because there is no V3-aware surface (DTOs, controller, services) to talk to it. This ticket (AC-524) prepares the Admin App API to support V3 as a first-class version, alongside the existing V1/V2 support.

## Primary User

Admin App API consumers — the Admin App's own frontend and internal services (e.g. future V3 UI and sync work) — that need a working backend surface to make requests against an Ed-Fi tenant's Admin API V3 instance. This is backend/API-consumer-facing work, not an end-user-facing UI feature.

## Job-to-be-Done

As a consumer of the Admin App API, I need to make requests (list/get/create/update/delete) against Vendors, Applications, API Clients, Claim Sets, Profiles, Resource Claims, Actions, Data Stores (formerly ODS Instances), Data Store Contexts/Derivatives, DB Data Stores, and tenant Education Organizations — through a V3-specific route surface — so that a tenant running Admin API V3 can be managed the same way V1/V2 tenants already are.

## Success Criteria

- Admin App API clients can call V3 Admin API endpoints (vendors, applications, api clients, claim sets, profiles, resource claims, actions, data stores, data store contexts/derivatives, db data stores, tenant edorgs) through new V3 controller routes mirroring the V2 route shape but under the `/v3` base path.
- All V3 request/response payloads and route parameters use the V3 naming (`dataStore`/`dataStoreId`/`dbDataStore`) instead of the V2 naming (`odsInstance`/`instanceId`/`dbInstance`).
- When the Admin API V3 backend returns an error, the Admin App API correctly surfaces it using the RFC 7807 problem-details fields (`type`/`title`/`status`/`detail`/`errors`) rather than the V2 error shape.
- A V3 environment can be registered/recognized so requests are routed to a tenant's V3 Admin API base URL (mirroring how V2 tenant routing already works).
- Existing V1/V2 behavior is unaffected — no regressions in currently-passing V1/V2 tests.
- Unit tests exist for the new V3 controller and service layer, covering the renamed endpoints/fields and the V3 error-handling path.

## Explicit Scope Boundaries

**In scope:**

- A new V3 surface for the Admin App API's Starting Blocks integration, covering the same set of capabilities V2 already exposes (vendors, applications, api clients, claim sets, profiles, resource claims, actions, data stores and related sub-resources, tenant edorgs).
- Renaming of the "ODS instance" concept to "data store" throughout the V3 surface's request/response payloads and route parameters, matching the real Admin API V3 specification.
- Correct handling of V3's RFC 7807 problem-details error responses so callers get an accurate, useful error rather than a mis-parsed one.
- Recognizing/registering a tenant environment as running Admin API V3 so requests route to the correct version-specific surface.
- Reusing existing shared logic where V2 and V3 behavior is genuinely identical (no naming or behavioral difference), rather than duplicating code that would immediately diverge from its source.

**Out of scope for v1:**

- Any frontend/UI work for V3 (tracked separately as AC-527–530).
- V3-aware synchronization/job-queue orchestration — i.e., the Admin App actively syncing data for a V3 environment (tracked separately as AC-526).
- Docker/Compose or other deployment infrastructure changes needed to run a V3 Admin API instance locally or in shared environments (tracked separately as AC-523).
- Introducing any new npm packages/libraries.

## Confirmed Assumptions

- Assumption: the V2→V3 field/route rename is `odsInstance(s)` → `dataStore(s)`, `dbInstance` → `dbDataStore`, and `instanceId`/`odsInstanceId` path/body params → `dataStoreId`, applied consistently across all ~44 endpoints and their DTOs. Confirmed: verified directly by diffing the live V2 and V3 swagger specs — the path and schema sets are otherwise a 1:1 match.
- Assumption: V3 Admin API error responses follow the RFC 7807 problem-details standard (`type`/`title`/`status`/`detail`/`errors`), differing from how V1/V2 errors are currently parsed. Confirmed by the user directly.
- Assumption: the shared `AdminApiMeta` version-detection union (in `edfi-admin-api.dto.ts`) needs a new version entry mapped to `'v3'` so a tenant environment can be recognized as running V3. Confirmed: proceed as in the (now-stale) PoC branch's precedent.
- Assumption: the shared V1/V2 exception filter (`AdminApiV1xExceptionFilter`) needs V3-specific handling (a new filter or an adaptation) to correctly parse the problem-details shape, rather than reusing the V1/V2 filter unchanged. Confirmed by the user directly.
- Assumption: where V2 and V3 behavior/shape is genuinely identical today (e.g. vendors, applications, claim sets, profiles, resource claims, actions — no rename, no behavioral change), the implementation should share/reuse that logic rather than fully duplicating it, to avoid two copies of identical code silently drifting apart. Confirmed by the user directly — this supersedes the raw feature request's literal instruction to duplicate every file; only the pieces that actually differ (data-store renames, error handling, version detection, route registration) get their own V3 code.
- Assumption: no new npm packages/libraries may be introduced; the V3 surface is implemented with what's already installed, consistent with how V1/V2 are built. Confirmed by the user directly.
- Assumption: frontend, sync/job-queue orchestration, and deployment infrastructure for V3 are explicitly out of scope for this feature — those are tracked in separate tickets (AC-527–530, AC-526, AC-523 respectively). Confirmed by the user directly.

## Open Questions / Risks (from pre-mortem)

- Risk: `edfi-admin-api.dto.ts` is shared across V1/V2/V3. Adding the V3 version-detection entry here means any future unrelated change to this file risks silently breaking V1/V2. Mitigation to consider during planning: keep the V3 addition minimal and additive, and ensure V1/V2 test coverage would catch a regression.
- Risk: because unchanged pieces are shared rather than duplicated between V2 and V3, a future V2-only bugfix could unintentionally change V3 behavior (or vice versa) if code assumed to be version-agnostic turns out not to be. Mitigation to consider during planning: be conservative about what counts as "genuinely identical" and lean toward isolating anything with tenant/version-specific branching.
- Risk: the `odsInstance` → `dataStore` rename spans many DTO classes, fields, and route params (~15+ DTO symbols, 44 routes) — a partial or inconsistent rename would produce confusing runtime errors, likely only surfaced when a real V3 tenant/environment is exercised (no live V3 environment in CI today). Mitigation to consider during planning: verification approach (e.g. cross-checking against the swagger specs) and thorough unit test coverage of renamed fields/routes.
- Risk: a shared code path could accidentally route a V2-shaped error through new V3-specific error handling, or vice versa, causing mis-parsed errors. Mitigation to consider during planning: scope the V3 exception filter narrowly (e.g. `@Catch` scoped to the V3 controller only, as the existing filter pattern already does per-version).

## Constraints

- New npm packages: not permitted — implement with what's already installed.
- Must not change existing V1/V2 request/response behavior or routes.
- Must follow the existing per-version module/routing pattern (`/:teamId/edfi-tenants/:edfiTenantId/admin-api/v3`, registered in `app.module.ts` / `routes.ts` the same way V1/V2 are).
- V3 error handling must correctly surface RFC 7807 problem-details fields to callers.

## Dependencies

- Existing V2 Starting Blocks module (`packages/api/src/teams/edfi-tenants/starting-blocks/v2/`) and V2 DTOs (`packages/models/src/dtos/edfi-admin-api.v2.dto.ts`, `packages/models/src/dtos/starting-blocks.v2.dto.ts`) as the structural basis for V3.
- Shared `edfi-admin-api.dto.ts` (version-detection union, response union types) and the V1/V2 exception filter pattern (`admin-api-v1x-exception.filter.ts`).
- Tenant/environment routing and module registration patterns in `app.module.ts` and `routes.ts`.
- Live V2 and V3 swagger specs (reachable locally at `https://localhost/odsv7-adminv2-multi-adminapi/swagger/v2/swagger.json` and `https://localhost/odsv7-adminv3-multi-adminapi/swagger/v3/swagger.json`) as the source of truth for exact V3 endpoint/field naming.
