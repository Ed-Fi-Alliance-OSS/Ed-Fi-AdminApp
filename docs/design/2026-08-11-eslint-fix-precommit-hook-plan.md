# ESLint Cleanup + Pre-Commit Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `npm run lint:check` to zero problems (currently 757: 128 errors, 629 warnings) and add a Husky + lint-staged pre-commit hook that blocks any commit introducing a lint error or warning.

**Architecture:** Phase 1 fixes ESLint config where the rule is firing on correct code (generated files, Playwright fixture syntax, a missing plugin registration) and runs the auto-fixer. Phase 2 works package-by-package fixing real findings by hand — real types for `no-explicit-any`, dead-code removal for `no-unused-vars`, targeted fixes for the smaller rule buckets. Phase 3 wires Husky + lint-staged so `git commit` runs `eslint --max-warnings 0` on staged files.

**Tech Stack:** ESLint 8 flat config (`eslint.config.mjs`), TypeScript, NestJS (`packages/api`), React (`packages/fe`, `packages/common-ui`), Jest, Playwright + playwright-bdd (`tests/e2e`), Nx monorepo, Husky, lint-staged.

## Global Constraints

- Spec: `docs/design/2026-08-11-eslint-fix-precommit-hook-design.md`.
- Fix all 757 currently-reported problems — no rule may be globally disabled to make a finding disappear; config changes are scoped to the specific files/patterns where the rule is firing on code that is actually correct.
- `no-explicit-any` fixes use real types wherever derivable from context; fall back to `unknown` + narrowing only when no concrete type exists.
- `no-unused-vars` fixes delete dead imports/vars; unused parameters that must stay for signature compatibility are prefixed with `_` (existing repo convention).
- Pre-commit hook gate is `--max-warnings 0` — zero tolerance, no baseline/grandfathering.
- After every task, run `npx eslint <path just fixed>` and confirm 0 problems in that path before moving on.
- Do not change runtime behavior while fixing types/dead code — after each package's Phase 2 tasks, run that package's existing test command (`npm run test:api`, `npm run test:fe`, `npm run test:models`, etc. — whichever applies) and confirm it still passes.

---

## Phase 1 — Config Fixes + Auto-Fix

### Task 1: Ignore generated e2e output and allow empty patterns in e2e step files

**Files:**
- Modify: `eslint.config.mjs`

**Interfaces:**
- Produces: updated `ignores` array and a new override block scoped to `files: ['tests/e2e/**/*.ts']`, consumed by no later task (config-only change).

- [ ] **Step 1: Add `.features-gen` to ignores**

In `eslint.config.mjs`, add `'**/tests/e2e/.features-gen'` to the existing `ignores` array (the first object in the exported array):

```js
{
  ignores: [
    '**/node_modules',
    '**/dist',
    '**/tmp',
    '**/.vscode',
    '**/migrations',
    '**/vite.config.*.timestamp*',
    '**/vitest.config.*.timestamp*',
    '**/tests/e2e/.features-gen',
  ],
},
```

- [ ] **Step 2: Disable `no-empty-pattern` for hand-written e2e step files**

Add a new config block after the existing `files: ['**/*.json']` block at the end of the exported array in `eslint.config.mjs`:

```js
{
  files: ['tests/e2e/**/*.ts'],
  rules: {
    'no-empty-pattern': 'off',
  },
},
```

- [ ] **Step 3: Verify**

Run: `npx eslint tests/e2e --format json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.reduce((n,f)=>n+f.messages.filter(m=>m.ruleId==='no-empty-pattern').length,0))"`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add eslint.config.mjs
git commit -m "chore(lint): ignore generated e2e output and allow Playwright fixture destructuring"
```

---

### Task 2: Fix Storybook renderer imports

**Files:**
- Modify: `packages/common-ui/src/lib/Icons/Icons.stories.tsx`
- Modify: `packages/common-ui/src/lib/ToggleButtonGroup.stories.tsx`
- Modify: `packages/common-ui/src/lib/operationResult/OperationResult.stories.tsx`
- Modify: `packages/common-ui/src/lib/pageLayout/PageTemplate.stories.tsx`
- Modify: `packages/common-ui/src/lib/resourceClaimsTable/ResourceClaimsTable.stories.tsx`
- Modify: `packages/common-ui/src/lib/sbaaTable/SbaaTable.stories.tsx`
- Modify: `packages/common-ui/src/lib/sbaaTable/SbaaTableServerSide.stories.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by later tasks (isolated fix).

- [ ] **Step 1: Confirm the framework package already in use**

Run: `cat packages/common-ui/.storybook/main.ts` (or equivalent Storybook config in that package) and confirm the `framework.name` value — expect `@storybook/react-vite` given `vite` is the build tool used across this repo's other Storybook configs.

- [ ] **Step 2: Swap the import in each of the 7 files above**

Each file currently has a top-level import shaped like:

```ts
import type { Meta, StoryObj } from '@storybook/react';
```

Change it to import from the framework package confirmed in Step 1:

```ts
import type { Meta, StoryObj } from '@storybook/react-vite';
```

Apply the identical change to all 7 files listed above.

- [ ] **Step 3: Verify**

Run: `npx eslint packages/common-ui --rule '{"storybook/no-renderer-packages": "error"}'`
Expected: no `storybook/no-renderer-packages` findings.

- [ ] **Step 4: Run Storybook build to confirm nothing broke**

Run: `nx run common-ui:build-storybook`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/common-ui/src/lib/Icons/Icons.stories.tsx packages/common-ui/src/lib/ToggleButtonGroup.stories.tsx packages/common-ui/src/lib/operationResult/OperationResult.stories.tsx packages/common-ui/src/lib/pageLayout/PageTemplate.stories.tsx packages/common-ui/src/lib/resourceClaimsTable/ResourceClaimsTable.stories.tsx packages/common-ui/src/lib/sbaaTable/SbaaTable.stories.tsx packages/common-ui/src/lib/sbaaTable/SbaaTableServerSide.stories.tsx
git commit -m "fix(lint): import Storybook framework package instead of renderer package"
```

---

### Task 3: Register `eslint-plugin-react-hooks` and fix the module-boundary import

**Files:**
- Modify: `eslint.config.mjs`
- Modify: `packages/api/src/teams/edfi-tenants/odss/odss.controller.ts:29`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Register the react-hooks plugin**

`packages/fe/src/app/Layout/Nav.tsx:154` has `// eslint-disable-next-line react-hooks/exhaustive-deps`, but the plugin providing that rule is never registered in the flat config, so ESLint errors with "Definition for rule 'react-hooks/exhaustive-deps' was not found." `eslint-plugin-react-hooks` (`^7.1.1`) is already a devDependency. In `eslint.config.mjs`, add the import at the top:

```js
import reactHooks from 'eslint-plugin-react-hooks';
```

Add a new config block scoped to `fe` and `common-ui` TSX files (after the existing `files: ['**/*.ts', '**/*.tsx']` non-null-assertion block):

```js
{
  files: ['packages/fe/**/*.tsx', 'packages/common-ui/**/*.tsx'],
  plugins: {
    'react-hooks': reactHooks,
  },
  rules: {
    'react-hooks/exhaustive-deps': 'warn',
  },
},
```

- [ ] **Step 2: Verify the disable comment now resolves and re-check the underlying deps warning**

Run: `npx eslint packages/fe/src/app/Layout/Nav.tsx`
Expected: no "Definition for rule ... was not found" error. If `react-hooks/exhaustive-deps` now fires as a real warning at line 155 (`useEffect(setTeamIdToDefault, [])`), leave the existing disable comment in place — it was already there deliberately to opt this specific effect out of the exhaustive-deps check.

- [ ] **Step 3: Fix the `@nx/enforce-module-boundaries` violation**

In `packages/api/src/teams/edfi-tenants/odss/odss.controller.ts:29`, change:

```ts
import { ReqUser } from 'packages/api/src/auth/helpers/user.decorator';
```

to the same relative-path style used by the other imports in this file:

```ts
import { ReqUser } from '../../../auth/helpers/user.decorator';
```

- [ ] **Step 4: Verify**

Run: `npx eslint eslint.config.mjs packages/fe/src/app/Layout/Nav.tsx packages/api/src/teams/edfi-tenants/odss/odss.controller.ts`
Expected: 0 errors related to `react-hooks/exhaustive-deps` definition or `@nx/enforce-module-boundaries`.

- [ ] **Step 5: Commit**

```bash
git add eslint.config.mjs packages/api/src/teams/edfi-tenants/odss/odss.controller.ts
git commit -m "fix(lint): register react-hooks plugin and fix relative import in odss.controller"
```

---

### Task 4: Run the auto-fixer and check in mechanical fixes

**Files:**
- Modify: whichever file(s) `eslint --fix` touches (expected: at minimum the single `no-var` site; run the full check to confirm the actual diff before committing).

- [ ] **Step 1: Run lint:fix**

Run: `npm run lint:fix`

- [ ] **Step 2: Review the diff**

Run: `git diff --stat`
Confirm every changed file is a mechanical fix (e.g. `var` → `let`/`const`) and not an unrelated formatting change. If `prettier:write` output shows up mixed in, that's fine — `lint:fix` and Prettier share formatting rules here.

- [ ] **Step 3: Verify**

Run: `npm run lint:check 2>&1 | Select-String "no-var"` (PowerShell) or `npm run lint:check 2>&1 | grep no-var` (bash)
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "chore(lint): apply eslint --fix auto-fixes"
```

---

### Task 5: Re-baseline the problem count before Phase 2

- [ ] **Step 1: Run the full check and capture the new count**

Run: `npm run lint:check 2>&1 | Select-String "problems"` (PowerShell) or `npm run lint:check 2>&1 | tail -5` (bash)

Expected remaining count: roughly 700 problems (408 `no-explicit-any` + 219 `no-unused-vars` + 22 `jest/no-conditional-expect` + 21 `no-unused-expressions` + 7 `no-empty-function` + 6 `jest/no-jasmine-globals` + 7 `no-undef` + 2 `jest/no-commented-out-tests` + 2 `jest/no-export` + 1 `jest/valid-title` + 1 `no-async-promise-executor`), spread across `packages/api`, `packages/fe`, `packages/common-ui`, `packages/models`, `packages/models-server`, and `tests/e2e`. No commit for this task — it's a checkpoint before Phase 2 begins.

---

## Phase 2 — Manual Fixes

### Task 6: `packages/api` — type the Admin API v1/v2/v3 service clients (largest `no-explicit-any` cluster)

**Files:**
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service.ts` (64 findings)
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/v1/admin-api.v1.service.ts` (34 findings)
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api.v3.service.ts` (33 findings)
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/v2/admin-api.v2.controller.spec.ts` (26 findings)
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/v1/admin-api.v1.service.spec.ts` (16 findings)
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api.v3.controller.spec.ts` (16 findings)
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/v1/admin-api.v1.controller.spec.ts` (5 findings)
- Modify: `packages/api/src/teams/edfi-tenants/starting-blocks/v3/admin-api-v3-exception.filter.spec.ts` (2 findings)

**Interfaces:**
- Consumes: existing DTOs from `@edanalytics/models` — `packages/models/src/dtos/edfi-admin-api.v2.dto.ts` and `packages/models/src/dtos/edfi-admin-api.v3.dto.ts` already define response types matching every Admin API resource these services call (`GetActionDtoV2`, `GetApiClientDtoV2`, `GetApplicationDtoV2`, `GetAuthStrategyDtoV2`, `GetClaimsetMultipleDtoV2`, `GetOdsInstanceSummaryDtoV2`, `GetOdsInstanceContextDtoV2`, `GetOdsInstanceDerivativeDtoV2`, `GetProfileDtoV2`, `GetResourceClaimDetailDtoV2`, `GetVendorDtoV2`, etc). Do not invent new types for v2/v3 — import and use these.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Type the v2 service's `.get<any, any[]>` calls**

In `admin-api.v2.service.ts`, each call is shaped `.get<any, any[]>('<resource>?...')` followed by `.then(...)`/`.map(...)` on the array result. Replace both type parameters with the matching DTO array type imported from `@edanalytics/models`. Example, for the `actions` endpoint (line 404):

```ts
// before
.get<any, any[]>(`actions?offset=0&limit=10000`)

// after
.get<GetActionDtoV2[], GetActionDtoV2[]>(`actions?offset=0&limit=10000`)
```

Apply the same pattern to every other `.get<any, any[]>('<resource>...')` call in the file, matching resource name to DTO:

| Endpoint | DTO |
|---|---|
| `applications` | `GetApplicationDtoV2` |
| `apiClients` | `GetApiClientDtoV2` |
| `authorizationStrategies` | `GetAuthStrategyDtoV2` |
| `claimSets` | `GetClaimsetMultipleDtoV2` |
| `odsInstances` | `GetOdsInstanceSummaryDtoV2` |
| `odsInstances/{id}/applications` | `GetApplicationAssignedToOdsInstanceDtoV2` |
| `odsInstanceContexts` | `GetOdsInstanceContextDtoV2` |
| `odsInstanceDerivatives` | `GetOdsInstanceDerivativeDtoV2` |
| `profiles` | `GetProfileDtoV2` |
| `resourceClaims` | `GetResourceClaimDetailDtoV2` |
| `vendors` | `GetVendorDtoV2` |
| `vendors/{id}/applications` | `GetApplicationDtoV2` |

Add the necessary imports from `@edanalytics/models` at the top of the file.

- [ ] **Step 2: Type the remaining single-generic and inline-callback `any` sites in the v2 service**

For `.get<any>('/', {...})` (line 1268) and `.get<any>('tenants/${tenantName}/odsInstances/edOrgs', {...})` (line 1359): inspect the code immediately following each call to see which fields are accessed on the result, and either reuse an existing DTO if one matches or declare a minimal local `interface` capturing only the fields actually used (name it `<Purpose>Response`, declared near the top of the file, exported if Step 1's table doesn't already cover the shape).

For the `AxiosError<any>` at line 269 and the inline callbacks `(instance: any) =>` / `(edOrg: any) =>` at lines 1384/1393: type `AxiosError<any>` as `AxiosError<{ message?: string }>` (or the actual error-body shape returned by the Admin API — check an existing `.catch` block elsewhere in this file for the error shape already assumed), and type `instance`/`edOrg` using `GetOdsInstanceDetailDtoV2`'s nested types (`odsInstances` / `educationOrganizations` field types) rather than re-declaring them.

- [ ] **Step 3: Repeat Steps 1–2's approach for the v1 and v3 services**

`admin-api.v1.service.ts` and `admin-api.v3.service.ts` follow the same `.get<any, any[]>('<resource>')` pattern against `@edanalytics/models`'s v1/v3 equivalents (`edfi-admin-api.v3.dto.ts` for v3; check `starting-blocks.v2.dto.ts` / the shared base DTOs in `edfi-admin-api.dto.ts` for v1, since a dedicated `edfi-admin-api.v1.dto.ts` doesn't exist — reuse the base/shared DTO classes from `edfi-admin-api.dto.ts` there). Apply the same endpoint-to-DTO mapping technique.

- [ ] **Step 4: Fix the `.spec.ts` files**

The 4 spec files' `any` usages are almost entirely mock data and mock function signatures (e.g. `jest.fn().mockResolvedValue({} as any)`, `(x: any) => ...` in test doubles). Replace each with the same real DTO type the corresponding service method now expects (from Steps 1–3) — the mock's shape should satisfy that type, not `any`. Where a mock deliberately returns a partial/malformed object to test an error path, use `as Partial<GetApplicationDtoV2>` (or the applicable DTO) instead of `as any`.

- [ ] **Step 5: Verify**

Run: `npx eslint packages/api/src/teams/edfi-tenants/starting-blocks --format json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.reduce((n,f)=>n+f.messages.length,0))"`
Expected: `0`

- [ ] **Step 6: Run the affected tests**

Run: `nx run api:test --testPathPattern=starting-blocks`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/teams/edfi-tenants/starting-blocks
git commit -m "fix(lint): type Admin API v1/v2/v3 service clients instead of using any"
```

---

### Task 7: `packages/api` — remaining `no-explicit-any` (certification, admin-api-version-strategy, utils, roles-global, sb-sync, users-global, sb-environments-global, ownerships-global, user-team-memberships-global, app, auth, edfi-tenants-global)

**Files:** every remaining `packages/api/src/**` file reported under `@typescript-eslint/no-explicit-any` after Task 6 (~176 findings across the directories named above — get the exact current list with the command in Step 1 before starting, since Task 6 changes the baseline).

**Interfaces:**
- Consumes: `@edanalytics/models` DTOs (same package as Task 6); check `packages/models-server/src` for entity/repository return types where the `any` sits on a database or ORM boundary instead of an HTTP boundary.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Get the current exact file list**

Run: `npx eslint packages/api/src --rule '{"@typescript-eslint/no-explicit-any": "error"}' --format json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));d.forEach(f=>{const c=f.messages.filter(m=>m.ruleId==='@typescript-eslint/no-explicit-any').length;if(c)console.log(c,f.filePath)})" | sort -rn`

- [ ] **Step 2: Fix each file**

For each file in the Step 1 list: open it, find each `any` usage, and determine its real type from context —
- HTTP request/response bodies: use the matching DTO from `@edanalytics/models` (same lookup approach as Task 6).
- ORM query results / repository methods: use the entity type from `@edanalytics/models-server` or the TypeORM `Repository<T>` generic already imported in the file.
- Generic utility functions: use a type parameter (`<T>`) instead of `any` if the function is meant to be generic; use the narrowest concrete type otherwise.
- Test mocks: match the type the code under test actually expects (same approach as Task 6 Step 4).
- Anywhere none of the above yields a type within a couple of minutes of investigation: use `unknown` and add the narrowing (`typeof`/`instanceof`/type guard) the surrounding code needs to use the value safely.

Work directory by directory (certification, then admin-api-version-strategy, then the rest) so each sub-area can be committed independently.

- [ ] **Step 3: Verify after each directory**

Run: `npx eslint packages/api/src/<directory> --rule '{"@typescript-eslint/no-explicit-any": "error"}'`
Expected: 0 problems, for each directory in turn.

- [ ] **Step 4: Run api tests**

Run: `npm run test:api`
Expected: all tests pass.

- [ ] **Step 5: Commit (per directory, or one commit if done in one sitting)**

```bash
git add packages/api/src
git commit -m "fix(lint): type remaining any usages in packages/api"
```

---

### Task 8: `packages/api` — `no-unused-vars` (79 findings)

**Files:** every `packages/api/src/**` file reported under `@typescript-eslint/no-unused-vars` — get the exact list with the command in Step 1.

- [ ] **Step 1: Get the current exact file list**

Run: `npx eslint packages/api/src --rule '{"@typescript-eslint/no-unused-vars": "error"}' --format json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));d.forEach(f=>{const c=f.messages.filter(m=>m.ruleId==='@typescript-eslint/no-unused-vars').length;if(c)console.log(c,f.filePath)})" | sort -rn`

- [ ] **Step 2: Fix each finding**

For each reported unused import or variable: delete it. If it's a destructured object property or catch-block error variable that must stay for the surrounding syntax (e.g. `catch (error) {}` where `error` is unused but the catch needs a binding, or a function parameter before a used one in the same signature), rename it with a leading underscore (`_error`) instead of deleting — matches this repo's existing convention (`_data`, `_options`, `_queueName`, `_id`, etc already used elsewhere).

- [ ] **Step 3: Verify**

Run: `npx eslint packages/api/src --rule '{"@typescript-eslint/no-unused-vars": "error"}'`
Expected: 0 problems.

- [ ] **Step 4: Run api tests**

Run: `npm run test:api`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src
git commit -m "fix(lint): remove unused vars/imports in packages/api"
```

---

### Task 9: `packages/api` — `no-unused-expressions` (7) and `jest/no-conditional-expect` (22)

**Files:** every `packages/api/src/**/*.spec.ts` file reported under either rule — get the exact list with Step 1.

- [ ] **Step 1: Get the current exact file list**

Run: `npx eslint packages/api/src --rule '{"@typescript-eslint/no-unused-expressions": "error", "jest/no-conditional-expect": "error"}' --format json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));d.forEach(f=>{const msgs=f.messages.filter(m=>['@typescript-eslint/no-unused-expressions','jest/no-conditional-expect'].includes(m.ruleId));if(msgs.length)console.log(f.filePath,JSON.stringify(msgs.map(m=>({line:m.line,rule:m.ruleId}))))})"`

- [ ] **Step 2: Fix `no-unused-expressions` sites**

Each is a statement that evaluates an expression without using its result — typically a missing `await`/`return` before a call that returns a promise or assertion chain, or a leftover statement from a refactor. Read the surrounding test to determine which: add the missing `await`/`return`, or delete the statement if it's genuinely dead.

- [ ] **Step 3: Fix `jest/no-conditional-expect` sites**

Each has an `expect(...)` call inside an `if`/`else`/`catch` block. Restructure so the assertion runs unconditionally:
- If testing that a promise rejects: replace the `try { await fn() } catch (e) { expect(e...) }` pattern with `await expect(fn()).rejects.toThrow(...)` (or `.rejects.toMatchObject(...)` if asserting on error shape).
- If the conditional exists to pick between two expected outcomes: split into two separate test cases, one per branch, each asserting unconditionally.

- [ ] **Step 4: Verify**

Run: `npx eslint packages/api/src --rule '{"@typescript-eslint/no-unused-expressions": "error", "jest/no-conditional-expect": "error"}'`
Expected: 0 problems.

- [ ] **Step 5: Run api tests**

Run: `npm run test:api`
Expected: all tests pass (same pass/fail outcomes as before — these are structural test fixes, not behavior changes).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src
git commit -m "fix(lint): restructure conditional/unused expectations in api specs"
```

---

### Task 10: `packages/api` — remaining misc rules

**Files:**
- Modify: `packages/api/src/utils/api-metadata-utils.spec.ts` (`jest/no-jasmine-globals`, 6 findings at lines 312, 326, 339, 386, 400, 583)
- Modify: `packages/api/src/certification/certification.controller.ts:16` (`no-empty-function`)
- Modify: `packages/api/src/certification/certification.service.ts:5` (`no-empty-function`)
- Modify: `packages/api/src/test/helpers/migration-smoke-test.helper.ts` (`no-empty-function` line 47, `jest/no-export` lines 8 and 25, `jest/valid-title` line 26)
- Modify: `packages/api/scripts/generate-migration-specs.mjs` (`no-undef`, lines 32, 40, 50, 62, 68, 72, 73)
- Modify: `packages/api/config/default.js:36` (`no-async-promise-executor`)

- [ ] **Step 1: Fix `jest/no-jasmine-globals` in api-metadata-utils.spec.ts**

At each of the 6 sites, replace `fail('<message>')` with `throw new Error('<message>')`, preserving the original message text.

- [ ] **Step 2: Fix `no-empty-function` in certification.controller.ts and certification.service.ts**

Read each empty constructor. If it exists only to declare/inject a dependency (e.g. `constructor(private readonly foo: Foo) {}` — an empty *body* with parameter properties is fine and shouldn't trigger this rule; re-check the exact line the linter flagged), the flagged constructor is likely fully empty (no parameters). Remove it entirely if nothing else in the class needs it — NestJS classes don't require an explicit constructor.

- [ ] **Step 3: Fix migration-smoke-test.helper.ts**

- `no-empty-function` (line 47): give the empty arrow function a body appropriate to its use (check what it's passed as — e.g. a no-op callback for a test double; if genuinely meant to be a no-op, add a single-line comment explaining why and keep an explicit empty body via `() => {}` only if the rule allows an inline disable — otherwise add a minimal body like `() => undefined`).
- `jest/no-export` (lines 8, 25): this file lives under `src/test/helpers/`, which the `jest/no-export` rule is treating as a test file due to eslint's test-file glob matching helper files too. Since this file is a genuine shared helper (not a `*.spec.ts`), add an override in `eslint.config.mjs` scoped to `files: ['**/test/helpers/**/*.ts']` (or the more specific `packages/api/src/test/helpers/**/*.ts`) that sets `'jest/no-export': 'off'`.
- `jest/valid-title` (line 26): the title passed to a `describe`/`it`/`test` call isn't a plain string (likely a template literal with interpolation, or a variable). Convert it to a plain string literal, or if dynamic titling is genuinely needed, wrap it in a template literal with only string-typed interpolations (the rule allows template literals — check the exact reported line to see which case applies).

- [ ] **Step 4: Fix generate-migration-specs.mjs**

This is a Node CLI script using `console`/`process` without a Node environment declared. Add a config block in `eslint.config.mjs` scoped to `files: ['**/scripts/**/*.mjs']` (or add `packages/api/scripts/**` specifically) with:

```js
{
  files: ['packages/api/scripts/**/*.mjs'],
  languageOptions: {
    globals: {
      console: 'readonly',
      process: 'readonly',
    },
  },
},
```

- [ ] **Step 5: Fix no-async-promise-executor in config/default.js:36**

Read the executor function at that line. Promise executors must be synchronous; move the `async` logic out — wrap the async work in an inner async function called from the (now synchronous) executor, or replace the `new Promise(async (resolve, reject) => {...})` pattern with a plain `async` function that doesn't wrap itself in a `new Promise` at all (most `async`-executor cases are removable this way once you trace where `resolve`/`reject` are actually called).

- [ ] **Step 6: Verify**

Run: `npx eslint packages/api/src/utils/api-metadata-utils.spec.ts packages/api/src/certification packages/api/src/test/helpers packages/api/scripts packages/api/config/default.js eslint.config.mjs`
Expected: 0 problems.

- [ ] **Step 7: Run api tests**

Run: `npm run test:api`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/utils/api-metadata-utils.spec.ts packages/api/src/certification packages/api/src/test/helpers packages/api/scripts packages/api/config/default.js eslint.config.mjs
git commit -m "fix(lint): fix remaining misc lint findings in packages/api"
```

---

### Task 11: `packages/fe` — `no-unused-vars` (110 findings)

**Files:** every `packages/fe/src/**` file reported under `@typescript-eslint/no-unused-vars` (72 under `Pages`, 12 under `helpers`, 12 under `routes`, 9 under `Layout`, ~5 elsewhere) — get the exact list with Step 1.

- [ ] **Step 1: Get the current exact file list**

Run: `npx eslint packages/fe/src --rule '{"@typescript-eslint/no-unused-vars": "error"}' --format json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));d.forEach(f=>{const c=f.messages.filter(m=>m.ruleId==='@typescript-eslint/no-unused-vars').length;if(c)console.log(c,f.filePath)})" | sort -rn`

- [ ] **Step 2: Fix each finding**

Same technique as Task 8, Step 2: delete unused imports/vars, prefix required-but-unused params with `_`. Work `Pages` first (largest cluster), then `helpers`, `routes`, `Layout`, and the remainder.

- [ ] **Step 3: Verify**

Run: `npx eslint packages/fe/src --rule '{"@typescript-eslint/no-unused-vars": "error"}'`
Expected: 0 problems.

- [ ] **Step 4: Run fe tests**

Run: `npm run test:fe`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/fe/src
git commit -m "fix(lint): remove unused vars/imports in packages/fe"
```

---

### Task 12: `packages/fe` — `no-explicit-any` (20), `no-unused-expressions` (7), `no-empty-function` (4)

**Files:**
- Modify: every `packages/fe/src/**` file reported under `@typescript-eslint/no-explicit-any` or `@typescript-eslint/no-unused-expressions` (get exact list per Step 1)
- Modify: `packages/fe/src/app/Pages/ApplicationV2/EditApplication.tsx:202`
- Modify: `packages/fe/src/app/Pages/IntegrationProvider/CreateIntegrationProviderPage.tsx:49`
- Modify: `packages/fe/src/app/Pages/IntegrationProvider/EditIntegrationProviderPage.tsx:65`
- Modify: `packages/fe/src/app/Pages/OwnershipGlobal/CreateOwnershipGlobalPage.tsx:160`

**Interfaces:**
- Consumes: DTOs/types from `@edanalytics/models` for API-response-shaped `any`s; component prop types already declared elsewhere in `packages/fe` for event-handler-shaped `any`s.

- [ ] **Step 1: Get the current exact file lists**

Run: `npx eslint packages/fe/src --rule '{"@typescript-eslint/no-explicit-any": "error", "@typescript-eslint/no-unused-expressions": "error"}' --format json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));d.forEach(f=>{const msgs=f.messages.filter(m=>['@typescript-eslint/no-explicit-any','@typescript-eslint/no-unused-expressions'].includes(m.ruleId));if(msgs.length)console.log(f.filePath,JSON.stringify(msgs.map(m=>({line:m.line,rule:m.ruleId}))))})"`

- [ ] **Step 2: Fix `no-explicit-any` sites**

Same technique as Task 7 Step 2: React event handlers get their real event type (`React.ChangeEvent<HTMLInputElement>`, etc.), API call results get the matching `@edanalytics/models` DTO, generic component props get a type parameter.

- [ ] **Step 3: Fix `no-unused-expressions` sites**

Same technique as Task 9 Step 2.

- [ ] **Step 4: Fix the 4 empty arrow functions**

At each of the 4 lines above, read what the empty arrow function is passed as (an event handler prop, a callback). If the component genuinely needs a no-op there (e.g. a required `onClick` prop with nothing to do yet), give it an explicit body that does nothing meaningful but documents why in one line, or better — check whether the prop can be made optional upstream so the empty handler isn't needed at all. Prefer removing the empty handler over keeping a no-op if the calling component allows the prop to be omitted.

- [ ] **Step 5: Verify**

Run: `npx eslint packages/fe/src --rule '{"@typescript-eslint/no-explicit-any": "error", "@typescript-eslint/no-unused-expressions": "error", "@typescript-eslint/no-empty-function": "error"}'`
Expected: 0 problems.

- [ ] **Step 6: Run fe tests**

Run: `npm run test:fe`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/fe/src
git commit -m "fix(lint): type any usages and fix empty handlers/expressions in packages/fe"
```

---

### Task 13: `packages/common-ui` — `no-unused-vars` (25), `no-unused-expressions` (7), `no-explicit-any` (2)

**Files:** every `packages/common-ui/src/**` file reported under any of these three rules — get exact list with Step 1.

- [ ] **Step 1: Get the current exact file list**

Run: `npx eslint packages/common-ui/src --rule '{"@typescript-eslint/no-unused-vars": "error", "@typescript-eslint/no-unused-expressions": "error", "@typescript-eslint/no-explicit-any": "error"}' --format json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));d.forEach(f=>{const msgs=f.messages.filter(m=>['@typescript-eslint/no-unused-vars','@typescript-eslint/no-unused-expressions','@typescript-eslint/no-explicit-any'].includes(m.ruleId));if(msgs.length)console.log(f.filePath,JSON.stringify(msgs.map(m=>({line:m.line,rule:m.ruleId}))))})"`

- [ ] **Step 2: Fix each finding**

Same techniques as Tasks 8/9/12 (unused-vars: delete or `_`-prefix; unused-expressions: fix missing await/dead statement; explicit-any: real prop/generic type — this is a shared component library, so check each component's existing exported prop `interface` first, the `any` is likely a prop that should already have a type declared two lines above it).

- [ ] **Step 3: Verify**

Run: `npx eslint packages/common-ui/src --rule '{"@typescript-eslint/no-unused-vars": "error", "@typescript-eslint/no-unused-expressions": "error", "@typescript-eslint/no-explicit-any": "error"}'`
Expected: 0 problems.

- [ ] **Step 4: Run common-ui tests / storybook build**

Run: `nx run common-ui:test` (if a test target exists) and `nx run common-ui:build-storybook`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add packages/common-ui/src
git commit -m "fix(lint): fix unused vars/expressions and any usages in packages/common-ui"
```

---

### Task 14: `packages/models`, `packages/models-server`, `tests/e2e`, `packages/utils` — remaining small clusters

**Files:**
- Modify: `packages/models/src/**` files reported under `@typescript-eslint/no-explicit-any` (5) and `@typescript-eslint/no-unused-vars` (2)
- Modify: `packages/models-server/src/**` files reported under `@typescript-eslint/no-unused-vars` (2)
- Modify: `tests/e2e/**` file reported under `@typescript-eslint/no-unused-vars` (1)
- Modify: `packages/utils/src/**` file reported under `@typescript-eslint/no-explicit-any` (1)
- Modify: `tests/e2e/login-page/login.spec.ts:39,43` (`jest/no-commented-out-tests`) and `:7` (`@typescript-eslint/no-unused-vars` on `expect`)

- [ ] **Step 1: Get the current exact file list**

Run: `npx eslint packages/models packages/models-server tests/e2e packages/utils --format json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));d.forEach(f=>{if(f.messages.length)console.log(f.filePath,JSON.stringify(f.messages.map(m=>({line:m.line,rule:m.ruleId}))))})"`

- [ ] **Step 2: Fix `no-explicit-any` and `no-unused-vars` in models/models-server/utils/e2e**

Same techniques as prior tasks — models/models-server `any` sites are almost certainly serializer or ORM boundary code, so check `packages/models/src/utils/make-serializer.spec.ts` (already modified per current git status — check it's not introducing new `any`s) and the entity definitions in `packages/models-server` for the real type before falling back to `unknown`.

- [ ] **Step 3: Fix login.spec.ts**

At lines 39 and 43: read the commented-out test code. If the scenario it covers is still relevant, uncomment and fix it into a working test (fixing any now-stale selectors/assertions against the current login page). If the scenario is obsolete, delete the commented block entirely rather than leaving it commented.

At line 7: `expect` is imported but unused — likely because the file currently only uses Playwright's `test.step`/`page` assertions inline or the import predates a refactor. Delete the unused `expect` import (or use it if a step in the file should be asserting with it and currently isn't — check intent by reading the whole file).

- [ ] **Step 4: Verify**

Run: `npx eslint packages/models packages/models-server tests/e2e packages/utils`
Expected: 0 problems.

- [ ] **Step 5: Run affected tests**

Run: `npm run test:models && nx run models-server:test`
Expected: all tests pass. (`tests/e2e` and `login.spec.ts` changes are verified by lint + a manual read, per the design's non-goal of not expanding e2e test execution scope in this change.)

- [ ] **Step 6: Commit**

```bash
git add packages/models packages/models-server tests/e2e packages/utils
git commit -m "fix(lint): fix remaining lint findings in models, models-server, utils, e2e"
```

---

### Task 15: Full verification sweep

- [ ] **Step 1: Run the complete lint check**

Run: `npm run lint:check`
Expected: exits 0, "0 problems" (or no output at all beyond the command itself, depending on how eslint reports a clean run).

- [ ] **Step 2: Run the full test suite**

Run: `npm run test:api && npm run test:fe && npm run test:models && npm run test:models-server && npm run test:utils`
Expected: all pass.

- [ ] **Step 3: If any problems remain**

Re-run the Step 1 command from whichever Phase 2 task covers the still-reporting file's directory, and repeat that task's fix technique — Phase 1/2 task file lists were snapshotted at plan-writing time; a small number of new findings appearing after earlier fixes touched shared code is expected and should be resolved with the same techniques, not a new task.

- [ ] **Step 4: Commit (only if Step 3 required changes)**

```bash
git add -u
git commit -m "fix(lint): resolve remaining findings surfaced during verification sweep"
```

---

## Phase 3 — Pre-Commit Hook

### Task 16: Add Husky + lint-staged

**Files:**
- Modify: `package.json`
- Create: `.husky/pre-commit`

**Interfaces:**
- Consumes: a fully clean `npm run lint:check` from Task 15 (the hook has no baseline exceptions to configure).
- Produces: nothing consumed by later tasks (final task in the plan).

- [ ] **Step 1: Install dependencies**

Run: `npm install --save-dev husky lint-staged`

- [ ] **Step 2: Add the `prepare` script**

In `package.json`, add to `"scripts"`:

```json
"prepare": "husky"
```

- [ ] **Step 3: Add the lint-staged config**

In `package.json`, add a top-level key:

```json
"lint-staged": {
  "*.{ts,tsx,js,jsx}": "eslint --max-warnings 0"
}
```

- [ ] **Step 4: Initialize Husky and create the hook**

Run: `npx husky init` (creates `.husky/` and wires `"prepare": "husky"` if not already present — confirm it doesn't overwrite the `lint-staged` config from Step 3 in `package.json`; if `husky init` also writes a sample `pre-commit` running `npm test`, replace its contents in the next sub-step)

Set the contents of `.husky/pre-commit` to exactly:

```sh
npx lint-staged
```

- [ ] **Step 5: Verify the hook blocks a bad commit**

Run:
```bash
echo "const x: any = 1;" >> packages/api/src/main.ts
git add packages/api/src/main.ts
git commit -m "test: verify hook blocks lint errors"
```
Expected: commit is rejected with an ESLint `no-explicit-any` failure printed by lint-staged.

Then revert the test change:
```bash
git checkout packages/api/src/main.ts
```

- [ ] **Step 6: Verify the hook allows a clean commit**

Run:
```bash
git add package.json package-lock.json .husky/pre-commit
git commit -m "chore: add husky + lint-staged pre-commit lint gate"
```
Expected: commit succeeds (lint-staged finds no staged `.ts`/`.tsx`/`.js`/`.jsx` lint problems, or the only staged files are `.json`/shell files lint-staged doesn't target).

- [ ] **Step 7: Confirm hook installs on fresh clone**

Run: `rm -rf node_modules/.cache 2>/dev/null; npm install` (or on Windows PowerShell: `Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue; npm install`)
Expected: `prepare` script runs Husky's install step without error, `.husky/pre-commit` still present and executable afterward.
