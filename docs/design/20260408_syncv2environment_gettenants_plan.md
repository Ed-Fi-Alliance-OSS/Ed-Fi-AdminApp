# Sync v2 Environment via AdminApiServiceV2.getTenants

## Summary
When the create flow reaches `syncv2Environment`, synchronization should pivot from frontend DTO-driven tenant/ODS payload persistence to Admin API discovery-driven synchronization using `AdminApiServiceV2.getTenants`.

Scope constraints:
- Apply only to v2 create flow.
- Keep v1 flow unchanged.
- Design first; implementation and tests happen after approval.

## Confirmed Architectural Decisions
1. For v2 create flow, Admin API discovery is the source of truth. UI tenant payload is not used as the synchronization source.
2. A tenant with empty `odsInstances` is valid and must not fail create.
3. Credential persistence path will use `StartingBlocksServiceV2.saveAdminApiCredentials(...)`.
4. Orphan tenant cleanup should run immediately during create-time v2 synchronization.

Primary call sites involved:
- `SbEnvironmentsEdFiService.create(...)` (v2 branch)
- `SbEnvironmentsEdFiService.syncv2Environment(...)`
- `AdminApiServiceV2.getTenants(...)`
- Pattern reference: `AdminApiSyncService.syncEnvironmentData(...)`

## Current State (Problem Statement)
Current v2 create path (`syncv2Environment`) does this:
1. Uses `createSbEnvironmentDto.tenants` as source of truth.
2. Creates/updates local tenant rows directly.
3. Builds ODS metadata from DTO (`createODSObject`) and persists with `persistSyncTenant`.
4. Creates Admin API credentials per tenant (optionally from pre-created cache map).

Implications:
- Synchronization depends on frontend payload accuracy instead of Admin API truth.
- Duplicate synchronization patterns exist across create flow vs admin-api sync flow.
- Some v2 create-time methods become redundant once discovery-based sync is adopted.

## Target Architecture
### Principle
For v2, `syncv2Environment` should call `AdminApiServiceV2.getTenants(sbEnvironment)` and synchronize local DB from that returned tenant model.

### High-level behavior after change
1. `create(...)` still validates URL/metadata and saves environment as now.
2. If v2:
   - Call new v2 sync orchestration that uses `getTenants`.
   - Persist tenants/ODS/EdOrgs from discovered data.
   - Provision credentials for newly discovered tenants when needed (multi-tenant).
3. v1 branch remains unchanged.

## Proposed Implementation Design
## Phase 1 - Wiring and orchestration shift
1. Inject `AdminApiServiceV2` into `SbEnvironmentsEdFiService`.
2. Refactor `syncv2Environment(...)` to:
   - Use `adminApiServiceV2.getTenants(sbEnvironment)`.
   - Handle empty result as success (no tenants discovered).
   - Iterate discovered tenants and upsert local `EdfiTenant` rows by `(name, sbEnvironmentId)`.
   - Persist ODS/EdOrg data from discovered tenant DTO shape using existing transactional path (`persistSyncTenant` via mapping helper).
3. Keep v1 methods untouched.

## Phase 2 - Credential strategy alignment
1. Reuse the credential provisioning approach inspired by `AdminApiSyncService.syncEnvironmentData(...)`:
   - For v2 multi-tenant, detect tenants discovered by API that are missing credentials in config.
   - Register credentials for those tenants (`/connect/register` with tenant header).
   - Persist credentials via `StartingBlocksServiceV2.saveAdminApiCredentials(...)`.
2. After credential provisioning, optionally re-fetch or re-login for completeness where needed.

## Phase 3 - Obsolete code reduction and cleanup
Candidate methods/logic in `SbEnvironmentsEdFiService` that may become partially or fully obsolete for v2 create path:
1. `syncMultiTenantEnvironment(...)` current DTO-loop behavior.
2. `syncSingleTenantEnvironment(...)` current DTO-first behavior.
3. `createAndSyncTenant(...)` DTO-based path.
4. `syncTenantData(...)` overload that depends on `PostSbEnvironmentDto` + `PostSbEnvironmentTenantDTO`.
5. `createODSObject(...)` if replaced by adapter from `TenantDto`.
6. `validateTenantsAndCreateCredentials(...)` pre-creation validation map for v2.
7. `tenantCredentialsMap` usage in `create(...)` and downstream signatures.

Cleanup strategy:
- Remove only code that has no remaining call sites after v2 refactor.
- Preserve v1 code paths and shared helpers still required by v1/update flow.
- Remove orphan tenants immediately after discovered-tenant processing in v2 create path.

## Detailed Data Flow (v2 create after change)
1. Validate Admin API URL and ODS metadata (existing).
2. Save `SbEnvironment` (existing).
3. Call `syncv2Environment(sbEnvironment, createSbEnvironmentDto)` (signature may drop `tenantCredentialsMap`).
4. `syncv2Environment`:
   - Calls `adminApiServiceV2.getTenants(sbEnvironment)`.
   - If multi-tenant, ensure credentials exist for discovered tenants (provision missing).
   - Upsert local tenants.
   - For each discovered tenant, map discovered ODS/EdOrg to syncable structure.
   - Persist with transaction via `persistSyncTenant`.
   - Keep tenants with empty `odsInstances` (valid state).
   - Remove orphan tenants in DB that are not returned by Admin API discovery.
5. Return success to create flow.

## Error Handling Strategy
1. Preserve `handleOperationError(...)` as central create error normalization.
2. In v2 sync:
   - Discovery failures from `getTenants` bubble to create catch (existing behavior).
   - Per-tenant persistence errors should include tenant name in logs and fail create.
   - Empty `odsInstances` does not count as an error condition.
3. Maintain field-specific `ValidationHttpException` where feasible.

## Testing Strategy (Unit tests required)
Target test files (or equivalent existing specs):
- `packages/api/src/sb-environments-global/sb-environments-edfi.services.spec.ts`

### New/updated test cases
1. v2 create calls `syncv2Environment` and `syncv2Environment` calls `adminApiServiceV2.getTenants`.
2. v2 create no longer requires DTO tenant list for data persistence if API discovery returns tenants.
3. v2 discovery returns empty list -> create succeeds and no tenant persistence performed.
4. v2 multi-tenant with discovered tenants missing credentials -> credential provisioning invoked.
5. v2 discovered tenant data persisted via `persistSyncTenant` mapping.
6. v2 discovery/auth failure propagates to create error handler.
7. v1 create path remains unchanged (regression test for `syncv1Environment`).
8. Obsolete map logic removed: tests no longer expect `validateTenantsAndCreateCredentials` flow in v2 create.
9. v2 tenant with empty `odsInstances` still creates/retains tenant and returns success.
10. v2 create removes orphan tenants not present in discovered tenant set.

### Mocking requirements
- Mock `AdminApiServiceV2.getTenants`.
- Mock repository saves/finds for `SbEnvironment` and `EdfiTenant`.
- Mock transaction boundary for `entityManager.transaction`.
- Mock credential persistence path (`StartingBlocksServiceV2.saveAdminApiCredentials` or chosen alternative).

## Risks and Mitigations
1. Risk: Circular dependency when injecting `AdminApiServiceV2`.
   - Mitigation: verify module exports/imports; use `forwardRef` if needed.
2. Risk: getTenants may return partial/empty tenant detail for missing credentials.
   - Mitigation: run credential provisioning before final persistence pass when multi-tenant; empty `odsInstances` remains valid.
3. Risk: behavior drift for single-tenant v2 where API returns `default` naming.
   - Mitigation: normalize tenant naming consistently and add regression tests.
4. Risk: deleting code used by update path inadvertently.
   - Mitigation: remove methods only after call-site analysis and tests.

## Open Questions
No open architectural questions at this time. Implementation can proceed using the confirmed decisions above.

## Acceptance Criteria
1. v2 create path uses `getTenants` as source for synchronization.
2. v1 create behavior remains unchanged.
3. Unit tests cover new v2 behavior and v1 regressions.
4. Any obsolete v2 DTO-sync code is removed safely without affecting update or v1 flows.
5. Error handling remains consistent with existing create API behavior.
