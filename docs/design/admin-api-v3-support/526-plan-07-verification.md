# Phase 7: Full regression pass and cleanup

> Part of the AC-526 implementation plan — see
> [526-plan-00-overview.md](./526-plan-00-overview.md) for goal, architecture, and global
> constraints. Previous phase: [526-plan-06-wire-sync.md](./526-plan-06-wire-sync.md).
> This is the final phase.

## Task 8: Full regression pass and cleanup

**Files:**
- None new — verification only.

- [ ] **Step 1: Run the full API test suite**

Run: `nx test api`
Expected: PASS — every existing V1/V2 test continues to pass with unchanged assertions;
all new V1/V2/V3 strategy and integration tests pass.

- [ ] **Step 2: Run lint**

Run: `nx lint api`
Expected: PASS — no unused imports left behind in
`sb-environments-edfi.services.ts`/`adminapi-sync.service.ts` from the deleted private
methods (e.g. `randomBytes`/`randomUUID` imports may now be unused in
`adminapi-sync.service.ts` if `createClientCredentials` was the only consumer — remove
any import that lint flags as unused).

- [ ] **Step 3: Run typecheck**

Run: `nx run api:typecheck` (or the project's equivalent `tsc --noEmit` target — check
`packages/api/project.json` for the exact target name if this one doesn't exist)
Expected: PASS

- [ ] **Step 4: Manually verify the success criteria from the design doc**

Confirm each of the following is demonstrably true from the tests added in Phases 1–6 (no
new code needed — this is a checklist, not new work):
- A V3 environment can be created and saves successfully (Phase 4 test).
- A newly created V3 environment's tenant/ODS/EdOrg data synchronizes automatically
  (Phase 6 test — `syncEnvironmentData` v3 path).
- A V3 environment's connection settings can be updated and data re-synchronizes (Phase 5
  test).
- V1 and V2 create/update/sync behavior is unchanged (Phase 4–6 full-suite regression
  runs).
- The V3 tenant-mode lock (single-tenant/multi-tenant) is enforced the same way V1/V2 is
  (Phase 5 test).

- [ ] **Step 5: Commit any lint/typecheck fixups**

```bash
git add -A
git commit -m "chore(AC-526): lint/typecheck cleanup after version-strategy refactor"
```

(Skip this commit if Steps 2–3 found nothing to fix.)

---

All phases complete. See [526-plan-00-overview.md](./526-plan-00-overview.md) for the
full phase index if resuming this plan later.
