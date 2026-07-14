# Node.js 24 Support Implementation Plan — Phase 2: Verification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** `plan-phase-1-config.md` (Tasks 1-3) is complete and committed —
`.nvmrc` is `24.18.0`, `engines.node` fields are `>=24.0.0`, both Dockerfiles use
`node:24-alpine`, and CI workflows read the Node version from `.nvmrc`.

**Goal:** Confirm the existing build and test suite passes unmodified on Node.js 24,
locally and in CI, performing only the minimal, in-scope dependency bumps required
to fix any incompatibility Node 24 surfaces.

**Architecture:** Run the full local build/test suite under Node 24. If everything
passes, push and confirm CI passes too. If something fails, identify the specific
incompatible dependency, bump only that dependency to its minimum Node-24-compatible
version, and re-verify — or, if no in-scope bump resolves it, stop and report the
blocker rather than working around it.

**Tech Stack:** npm, Nx, Jest, Playwright, GitHub Actions.

## Global Constraints

(Same constraints as Phase 1 — repeated here since this phase's tasks implicitly
depend on them.)

- No new third-party packages may be added. Only bump existing dependencies, and
  only if verification proves they are incompatible with Node 24.
- No application behavior may change as a result of this work.
- If any dependency incompatibility, native-module failure, or test breakage
  surfaces during verification that cannot be fixed via an in-scope compatibility
  bump, stop and report — do not patch around it with workarounds. This work then
  defers to release 4.2 instead of shipping in 4.1.

---

### Task 4: Local build and full test suite verification on Node 24

**Files:**
- No file changes — this task only runs and observes the existing build/test
  tooling under Node 24.

**Interfaces:**
- Consumes: Node 24.18.0 active locally, updated `engines` fields (both from
  Phase 1, Task 1).

- [ ] **Step 1: Confirm Node 24 is active**

```bash
node --version
```

Expected: `v24.18.0`. If not, run `nvm use 24.18.0` first.

- [ ] **Step 2: Clean install dependencies**

```bash
rm -rf node_modules
npm ci --legacy-peer-deps
```

Expected: completes with exit code 0, no `EBADENGINE` errors.

- [ ] **Step 3: Run the full build**

```bash
npm run build
```

Expected: both `build:fe` and `build:api` (via Nx) complete with exit code 0.

- [ ] **Step 4: Run each package's unit test suite**

```bash
npm run test:api
npm run test:fe
npm run test:models
npm run test:models-server
npm run test:utils
```

Expected: every command exits 0 with all existing tests passing (same pass/fail
counts as on Node 22 — no new failures, no skipped/modified tests).

- [ ] **Step 5: Run the e2e/BDD test suite**

```bash
npm run test:e2e:bdd
```

Expected: exits 0, same pass/fail counts as the pre-change baseline.

- [ ] **Step 6: Decision gate**

If every command in Steps 2-5 passed with no changes needed: skip Task 5 entirely
(there's nothing to bump) and proceed to Task 6.

If any command failed:
1. Identify the specific failing package/dependency from the error output.
2. Go to Task 5 and perform the minimal compatibility bump for that specific
   package only.
3. Re-run the failing command(s) from this task to confirm the fix, then continue.
4. If a failure cannot be resolved by bumping the specific incompatible
   dependency to its next Node-24-compatible version (e.g., it requires an
   application code change), STOP. Do not implement a workaround. Report this as
   a blocker per the Global Constraints — this change defers to release 4.2.

---

### Task 5: Dependency compatibility bumps (conditional — only if Task 4 found failures)

**Files:**
- Modify: only the specific `package.json` (root or a `packages/*/package.json`)
  containing the dependency identified as incompatible in Task 4.
- Modify: `package-lock.json` (regenerated automatically by `npm install`).

**Interfaces:**
- Consumes: the specific failing package name + error output captured in Task 4,
  Step 6.

If Task 4 passed cleanly, skip this task entirely — do not bump any dependency
speculatively (out of scope per the Global Constraints).

For each dependency Task 4 identified as incompatible with Node 24:

- [ ] **Step 1: Identify the minimum compatible version**

Check the dependency's changelog/release notes (e.g. `npm view <package> versions`
combined with its GitHub releases) for the earliest version whose `engines.node`
supports `>=24` or whose changelog states Node 24 support.

- [ ] **Step 2: Bump the dependency**

```bash
npm install <package>@<minimum-compatible-version> --save-exact=false --legacy-peer-deps
```

(Use `--save-dev` instead of `--save` if it's currently a devDependency — check its
current location in the relevant `package.json` first.)

- [ ] **Step 3: Re-run the specific failing command from Task 4**

Re-run whichever of `npm ci`, `npm run build`, or the specific `npm run test:*`
command failed, to confirm the bump fixes it and introduces no new failures.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json packages/*/package.json
git commit -m "build: bump <package> to <version> for Node.js 24 compatibility"
```

- [ ] **Step 5: Return to Task 4, Step 6 decision gate**

Re-run the full Task 4 verification sequence (Steps 2-5) from a clean install to
confirm no regressions, then re-evaluate the decision gate.

---

### Task 6: CI verification

**Files:**
- No file changes — this task pushes the branch and observes CI results.

**Interfaces:**
- Consumes: all changes from Phase 1 (Tasks 1-3) and this phase's Tasks 4-5.

- [ ] **Step 1: Push the branch**

```bash
git push
```

- [ ] **Step 2: Confirm the PR workflow passes**

Open the GitHub Actions run for `on-pullrequest.yml` triggered by the push (or the
open PR). Expected: the `setup`, `code_analysis`, `lint`, and `build_and_test`
(all matrix entries: `fe`, `be`, `models`, `models-server`, `utils`) jobs all pass,
and the `Setup Node (from .nvmrc)` step logs show Node 24.18.0 was installed.

- [ ] **Step 3: Confirm the e2e UI workflow passes**

Open the GitHub Actions run for `run-e2e-ui.yml`. Expected: passes, and the
`Setup Node (from .nvmrc)` step logs show Node 24.18.0.

- [ ] **Step 4: Confirm no other Node version references remain**

```bash
grep -rn "node:22\|node-version: '22\|node-version: 22\|22\.23\.0\|>=22\.0\.0" \
  --include="*.yml" --include="*.yaml" --include="Dockerfile*" --include="package.json" \
  --include=".nvmrc" . | grep -v node_modules
```

Expected: no output (empty). This confirms the Success Criteria "no repository
file declares or pins Node.js 22" is met.

- [ ] **Step 5: Final commit (if Step 4 found stragglers)**

If Step 4 found any remaining reference, fix it following the same pattern as
Phase 1's Tasks 1-3, then commit:

```bash
git add -A
git commit -m "build: remove remaining Node.js 22 references"
git push
```

If Step 4 found nothing, no commit is needed — this task is complete.

---

## Self-Review Notes (covers both phases)

- **Spec coverage:** All five design sections (single source of truth, CI
  standardization, Docker images, dependency bumps, verification) map to Phase 1
  Tasks 1-3 and Phase 2 Tasks 4-6. The `copilot-setup-steps.yml` correction from
  the spec is reflected as an explicit "no change" line in Phase 1's Task 3.
- **Placeholder scan:** The only bracketed placeholders (`<digest-from-step-1>` in
  Phase 1, `<package>`/`<minimum-compatible-version>` here) are values that can
  only be known by running a command during execution (a live Docker digest, or a
  not-yet-identified failing dependency) — each is preceded by an explicit command
  that produces the concrete value, not a deferred decision.
- **Type/name consistency:** Script names (`build`, `test:api`, `test:fe`,
  `test:models`, `test:models-server`, `test:utils`, `test:e2e:bdd`) are copied
  verbatim from `package.json` and used identically across both phase documents.
