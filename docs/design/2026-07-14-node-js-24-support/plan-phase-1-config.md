# Node.js 24 Support Implementation Plan — Phase 1: Version Config

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update every place that declares or pins the Node.js version — the
`.nvmrc`/`engines` fields, the Docker base images, and the CI workflow Node setup
steps — to Node.js 24, with no application behavior change.

**Architecture:** This is a configuration-only change: bump the version pinned in
`.nvmrc` (the single source of truth), point every `engines.node` field at it, bump
the Docker base images to `node:24-alpine`, and standardize CI workflows to read the
version from `.nvmrc`. Phase 2 (`plan-phase-2-verification.md`) runs the full
build/test verification and any conditional dependency bumps once this phase's
changes are in place.

**Tech Stack:** nvm-windows (local Node version management), GitHub Actions
(`actions/setup-node`), Docker (multi-stage builds).

**Continues in:** `docs/design/2026-07-14-node-js-24-support/plan-phase-2-verification.md`

## Global Constraints

- Node version target: **24.18.0** (latest Node 24 LTS patch as of 2026-07-14,
  "Krypton" LTS line, maintenance through April 2028).
- Root `package.json` `engines.node` and `packages/api/package.json`
  `engines.node`: range style `>=24.0.0` (not an exact pin — matches existing
  convention).
- `.npmrc` has `engine-strict=true` — `npm ci`/`npm install` will hard-fail if the
  running Node version doesn't satisfy `engines.node`. This is the enforcement
  mechanism; do not weaken or remove it.
- No new third-party packages may be added.
- No application behavior may change as a result of this work.
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
  Task 2 (Docker) and Task 3 (CI) both read from or must match.

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
handled in Phase 2's conditional dependency-bump task, not here.

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
- Produces: Docker images that install/build/run under Node 24, feeding Phase 2's
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
- Produces: CI configuration that Phase 2's CI verification task exercises.

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

## Phase 1 Exit Criteria

All of Tasks 1-3 committed, each verified locally (`npm ci` under Node 24 succeeds,
both Docker images build successfully, CI workflow YAML is valid). Proceed to
`plan-phase-2-verification.md` for full build/test suite verification and CI
confirmation.
