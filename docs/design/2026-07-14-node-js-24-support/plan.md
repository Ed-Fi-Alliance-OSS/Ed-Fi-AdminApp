# Node.js 24 Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move AdminApp's local dev, CI, and container runtime from Node.js 22 to
Node.js 24, with no application behavior change.

**Architecture:** This is a configuration-only change: bump the version pinned in
`.nvmrc` (the single source of truth), point every `engines.node` field and CI
workflow step at that version, bump the Docker base images to `node:24-alpine`, then
verify the existing build/test suite passes unmodified.

**Tech Stack:** nvm-windows (local Node version management), GitHub Actions
(`actions/setup-node`), Docker (multi-stage builds), Nx, npm, Jest, Playwright.

## Global Constraints

- Node version target: **24.18.0** (latest Node 24 LTS patch as of 2026-07-14,
  "Krypton" LTS line, maintenance through April 2028).
- Root `package.json` `engines.node` and `packages/api/package.json`
  `engines.node`: range style `>=24.0.0` (not an exact pin — matches existing
  convention).
- `.npmrc` has `engine-strict=true` — `npm ci`/`npm install` will hard-fail if the
  running Node version doesn't satisfy `engines.node`. This is the enforcement
  mechanism; do not weaken or remove it.
- No new third-party packages may be added. Only bump existing dependencies, and
  only if verification proves they are incompatible with Node 24.
- No application behavior may change as a result of this work.
- If any dependency incompatibility, native-module failure, or test breakage
  surfaces during verification that cannot be fixed via an in-scope compatibility
  bump, stop and report — do not patch around it with workarounds. This work then
  defers to release 4.2 instead of shipping in 4.1.
- Docker base images continue to be pinned by exact `sha256` digest (not a floating
  tag), matching current practice.

---

### Task 1: Bump the Node version pin and `engines` fields

**Files:**
- Modify: `.nvmrc`
- Modify: `package.json:33-35`
- Modify: `packages/api/package.json:12-14`

**Interfaces:**
- Produces: the repo-wide Node version source of truth (`.nvmrc` = `24.18.0`) that
  Task 3 (Docker) and Task 4 (CI) both read from or must match.

- [ ] **Step 1: Update `.nvmrc`**

Replace the file contents (currently `22.23.0`) with:

```
24.18.0
```

- [ ] **Step 2: Update root `package.json` engines field**

In `package.json`, change:

```json
  "engines": {
    "node": ">=22.0.0"
  },
```

to:

```json
  "engines": {
    "node": ">=24.0.0"
  },
```

- [ ] **Step 3: Update `packages/api/package.json` engines field**

In `packages/api/package.json`, change:

```json
  "engines": {
    "node": ">=22.0.0"
  },
```

to:

```json
  "engines": {
    "node": ">=24.0.0"
  },
```

- [ ] **Step 4: Install Node 24.18.0 locally via nvm-windows**

Run:

```bash
nvm install 24.18.0
nvm use 24.18.0
node --version
```

Expected: outputs `v24.18.0`.

- [ ] **Step 5: Verify `engine-strict` enforcement works end-to-end**

With Node 24.18.0 active, run from the repo root:

```bash
npm ci --legacy-peer-deps
```

Expected: install completes without an `engines` mismatch error (confirms
`>=24.0.0` is satisfied). If any transitive dependency prints an `EBADENGINE`
warning/error naming a specific package, note the package name — it will be
handled in Task 5 (Dependency compatibility bumps), not here.

- [ ] **Step 6: Commit**

```bash
git add .nvmrc package.json packages/api/package.json
git commit -m "build: bump Node.js version pin to 24.18.0"
```

---

### Task 2: Bump Docker base images to `node:24-alpine`

**Files:**
- Modify: `packages/api/Dockerfile:10` (build stage)
- Modify: `packages/api/Dockerfile:39` (runtime stage)
- Modify: `packages/fe/Dockerfile:12` (build stage)

**Interfaces:**
- Consumes: Node 24.18.0 as the target version (Task 1).
- Produces: Docker images that install/build/run under Node 24, feeding Task 6
  verification.

- [ ] **Step 1: Resolve the current `node:24-alpine` digest**

Run:

```bash
docker pull node:24-alpine
docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
```

Expected: prints something like
`node@sha256:<64-hex-chars>`. Copy the `sha256:<...>` value — this is the exact
digest to use in the next steps. (Do not hand-copy a digest from a web page or
memory; always resolve it live via `docker pull` + `docker inspect`, since Docker
Hub digests change on every image rebuild.)

- [ ] **Step 2: Update `packages/api/Dockerfile` build stage**

Change line 10 from:

```dockerfile
FROM node:22-alpine@sha256:b2358485e3e33bc3a33114d2b1bdb18cdbe4df01bd2b257198eb51beb1f026c5 AS build
```

to (substituting the digest resolved in Step 1):

```dockerfile
FROM node:24-alpine@sha256:<digest-from-step-1> AS build
```

- [ ] **Step 3: Update `packages/api/Dockerfile` runtime stage**

Change line 39 from:

```dockerfile
FROM node:22-alpine@sha256:b2358485e3e33bc3a33114d2b1bdb18cdbe4df01bd2b257198eb51beb1f026c5 AS runtime
```

to the same digest used in Step 2:

```dockerfile
FROM node:24-alpine@sha256:<digest-from-step-1> AS runtime
```

- [ ] **Step 4: Update `packages/fe/Dockerfile` build stage**

Change line 12 from:

```dockerfile
FROM node:22-alpine@sha256:b2358485e3e33bc3a33114d2b1bdb18cdbe4df01bd2b257198eb51beb1f026c5 AS build
```

to the same digest used in Step 2:

```dockerfile
FROM node:24-alpine@sha256:<digest-from-step-1> AS build
```

- [ ] **Step 5: Build the API image locally**

From the repository root (both Dockerfiles require this, per their header
comments):

```bash
docker build -f packages/api/Dockerfile -t adminapp-api:node24-test .
```

Expected: build completes successfully through both the `build` and `runtime`
stages, with no `apk`, `npm ci`, or `nx build` failures.

- [ ] **Step 6: Build the FE image locally**

```bash
docker build -f packages/fe/Dockerfile -t adminapp-fe:node24-test .
```

Expected: build completes successfully; the `npm ci` and `nx run fe:build:production`
steps in the `build` stage succeed under Node 24.

- [ ] **Step 7: Commit**

```bash
git add packages/api/Dockerfile packages/fe/Dockerfile
git commit -m "build: bump Docker base images to node:24-alpine"
```

---

### Task 3: Standardize CI workflows on `.nvmrc`

**Files:**
- Modify: `.github/workflows/on-prerelease.yml:44-48` (first Node setup step)
- Modify: `.github/workflows/on-prerelease.yml:295-298` (second Node setup step)
- Modify: `.github/workflows/run-e2e-ui.yml:41-45` (Node setup step)
- No change: `.github/workflows/on-pullrequest.yml` (already reads `.nvmrc`)
- No change: `.github/workflows/copilot-setup-steps.yml` (does not set up Node)

**Interfaces:**
- Consumes: `.nvmrc` = `24.18.0` (Task 1) as the version every workflow now reads.

- [ ] **Step 1: Update the first Node setup step in `on-prerelease.yml`**

Change (around line 44):

```yaml
      - name: Set up Node.js (22.x)
        uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          cache: 'npm'
```

to:

```yaml
      - name: Set up Node.js (from .nvmrc)
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
```

- [ ] **Step 2: Update the second Node setup step in `on-prerelease.yml`**

Change (around line 295):

```yaml
      - name: Set up Node.js (22.x)
        uses: actions/setup-node@v4
        with:
          node-version: '22.x'
```

to:

```yaml
      - name: Set up Node.js (from .nvmrc)
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
```

- [ ] **Step 3: Update the Node setup step in `run-e2e-ui.yml`**

Change (around line 41):

```yaml
      - name: Setup Node 22.23.0
        uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
        with:
          node-version: 22.23.0
          cache: npm
```

to:

```yaml
      - name: Setup Node (from .nvmrc)
        uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
        with:
          node-version-file: '.nvmrc'
          cache: npm
```

- [ ] **Step 4: Validate YAML syntax**

Run (requires Node 24 active from Task 1, or any Node — this only parses YAML):

```bash
node -e "require('js-yaml') ? null : null" 2>/dev/null; \
npx js-yaml .github/workflows/on-prerelease.yml > /dev/null && echo "on-prerelease.yml OK"
npx js-yaml .github/workflows/run-e2e-ui.yml > /dev/null && echo "run-e2e-ui.yml OK"
```

Expected: both print their `OK` line with no parse errors. (If `js-yaml` is not
resolvable via `npx` in this repo, instead open both files and confirm indentation
is 6 spaces for the `with:` block's `node-version-file:` key, matching the
surrounding steps — see `on-pullrequest.yml:39-41` for the reference indentation
this repo already uses.)

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/on-prerelease.yml .github/workflows/run-e2e-ui.yml
git commit -m "ci: standardize Node version setup on .nvmrc"
```

---

### Task 4: Local build and full test suite verification on Node 24

**Files:**
- No file changes — this task only runs and observes the existing build/test
  tooling under Node 24.

**Interfaces:**
- Consumes: Node 24.18.0 active locally (Task 1), updated `engines` fields
  (Task 1).

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

If every command in Steps 2-5 passed with no changes needed: proceed to Task 5
(skip its dependency-bump steps — there's nothing to bump) and then Task 6.

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
- Consumes: all changes from Tasks 1-5.

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
Tasks 1-3, then commit:

```bash
git add -A
git commit -m "build: remove remaining Node.js 22 references"
git push
```

If Step 4 found nothing, no commit is needed — this task is complete.

---

## Self-Review Notes

- **Spec coverage:** All five design sections (single source of truth, CI
  standardization, Docker images, dependency bumps, verification) map to Tasks
  1-6. The `copilot-setup-steps.yml` correction from the spec is reflected as an
  explicit "no change" line in Task 3.
- **Placeholder scan:** The only bracketed placeholders (`<digest-from-step-1>`,
  `<package>`, `<minimum-compatible-version>`) are values that can only be known
  by running a command during execution (a live Docker digest, or a
  not-yet-identified failing dependency) — each is preceded by an explicit command
  that produces the concrete value, not a deferred decision.
- **Type/name consistency:** Script names (`build`, `test:api`, `test:fe`,
  `test:models`, `test:models-server`, `test:utils`, `test:e2e:bdd`) are copied
  verbatim from `package.json`. File line numbers reference the current
  (pre-change) state of each file, since each task modifies them in sequence.
