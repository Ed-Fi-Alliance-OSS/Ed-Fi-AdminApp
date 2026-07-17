# V3 Environment Sync Validation via Bruno — Design

Related: [526-design.md](./526-design.md), [526-task.md](./526-task.md) (AC-526).

## Problem Statement

AC-526 wired V3 environments into the create/update/sync pipeline
(`AdminApiVersionStrategy`), but there's no easy way to validate the result end-to-end. V1
and V2 environments can be exercised through the Admin App frontend (create/edit screens),
but V3 has no frontend yet (out of scope, tracked separately as AC-527–530). Without the
UI, validating V3 sync today means manually crafting requests against the Admin App API,
which is slow and not repeatable.

## Primary User

Developers and reviewers validating the AC-526 implementation — both the author confirming
the change works, and reviewers/QA checking it before merge.

## Job-to-be-Done

As a developer who just implemented or is reviewing the V3 sync work, I need a repeatable
set of requests I can fire at the Admin App API to create a V3 environment, confirm its
data actually synced, exercise the update/resync and manual-refresh paths, and confirm the
tenant-mode lock still holds — without needing the (nonexistent) V3 frontend.

## Success Criteria

- A person with a running local Admin App API (via `compose/`) and a valid `ACCESS_TOKEN`
  can run a sequence of Bruno requests that creates a V3 single-tenant environment and
  confirms tenant/ODS/education-organization data appears on it.
- The same suite also covers: multi-tenant V3 creation, update-triggers-resync, manual
  refresh-resources, and the tenant-mode-lock rejection.
- Requests clean up after themselves (delete the environments they create) so the suite is
  safely re-runnable.
- No new auth mechanism is introduced — the suite reuses the existing `{{ACCESS_TOKEN}}` /
  `{{BASE_URL}}` convention already used by `tests/api/collections/auth` and `.../app`.

## Scope

**In scope:**

- A new `environments` folder under `tests/api/collections/`, following the existing
  Bruno collection's conventions (`.bru` files, `tests {}` assertions, shared
  `BASE_URL`/`ACCESS_TOKEN` vars from `tests/api/environments/{ci,local}.bru`).
- Requests covering: create V3 single-tenant, create V3 multi-tenant, get (verify synced
  data), update (URL change → resync), manual refresh-resources, update (tenant-mode-lock
  rejection), and cleanup deletes.

**Out of scope:**

- Any V1/V2 regression coverage (already validated through the frontend; not requested).
- Automating suite execution in CI (this is a manual validation aid, not a new CI gate).
- Solving how `ACCESS_TOKEN` is obtained — the existing collection already assumes this is
  populated by the developer; this design doesn't change that.
- `.http` files — the chosen tool is Bruno only (per user decision), since the Admin App
  API's own request/response shapes (JSON bodies, header auth) fit the existing Bruno
  pattern better than the raw-Admin-API `.http` files under `compose/http/`.

## Architecture

Plain data addition — no code changes. A new folder `tests/api/collections/environments/`
holds one `.bru` file per request, numbered via `seq` for a natural run order, mirroring
`tests/api/collections/auth/`. Bruno's built-in variable capture
(`vars:post-response` blocks, referencing `res.body.id` etc.) threads the created
environment's `id` from the create requests into the later get/update/delete requests —
same mechanism already used in `compose/http/*.http` via `@name` (Bruno's equivalent is
naming the request and referencing `{{requestName.response.body.field}}` or capturing into
a folder-scoped var).

## Components

New files under `tests/api/collections/environments/`:

| File | Method & path | Purpose |
|---|---|---|
| `01-create-v3-single.bru` | `POST /sb-environments` | Create a V3 single-tenant environment (`version: 'v3'`, `isMultitenant: false`, points at `odsv7-adminv3-single-{adminapi,api}`). Asserts 2xx and a `syncQueue` in the body. Captures `id` into `v3SingleEnvId`. |
| `02-create-v3-multi.bru` | `POST /sb-environments` | Create a V3 multi-tenant environment (`isMultitenant: true`, points at `odsv7-adminv3-multi-{adminapi,api}`). Asserts 2xx and `syncQueue`. Captures `id` into `v3MultiEnvId`. |
| `03-get-v3-single-synced.bru` | `GET /sb-environments/{{v3SingleEnvId}}` | Asserts `edfiTenants` is non-empty and at least one tenant has `odss` populated — confirms sync actually persisted data, not just queued. |
| `04-update-v3-single-triggers-resync.bru` | `PUT /sb-environments/{{v3SingleEnvId}}` | Changes `adminApiUrl` to a different valid V3 admin API URL. Asserts response includes a fresh `syncQueue`. |
| `05-refresh-resources-v3-single.bru` | `PUT /sb-environments/{{v3SingleEnvId}}/refresh-resources` | Manual on-demand refresh. Asserts 2xx and `syncQueue`. |
| `06-update-v3-single-tenant-mode-locked.bru` | `PUT /sb-environments/{{v3SingleEnvId}}` | Attempts to flip `isMultitenant` to `true` on the single-tenant env. Asserts a 4xx rejection. |
| `07-cleanup-delete-v3-single.bru` | `DELETE /sb-environments/{{v3SingleEnvId}}` | Removes the single-tenant environment created in step 1. |
| `08-cleanup-delete-v3-multi.bru` | `DELETE /sb-environments/{{v3MultiEnvId}}` | Removes the multi-tenant environment created in step 2. |

No changes to `tests/api/bruno.json` or `tests/api/environments/*.bru` are needed — the new
folder inherits the collection's existing `BASE_URL`/`ACCESS_TOKEN` vars.

## Data Flow

1. Developer starts the local Admin App stack (`compose/`), including the V3 single- and
   multi-tenant Admin API/ODS API containers (`odsv7-adminv3-{single,multi}-{adminapi,api}`,
   per `compose/.env.example`).
2. Developer opens the collection in Bruno, selects the `local` (or `ci`) environment, sets
   `ACCESS_TOKEN` (same manual step already required for `auth/me.bru` etc.).
3. Runs the `environments` folder in sequence (Bruno "Run Folder" preserves file order by
   `seq`). Each request's assertions surface pass/fail inline; captured vars flow forward
   automatically.
4. Cleanup requests run last regardless of whether earlier assertions failed, so
   re-running the folder doesn't accumulate stale environments (Bruno runs all requests in
   a folder run by default, even after a prior request's test assertions fail — only a
   transport-level error would break the chain, which is an acceptable limitation of a
   manual validation aid, not something this design needs to work around).

## Error Handling

- If Admin API URLs are unreachable (V3 containers not running), create requests will
  return whatever error the existing `AdminApiSyncService`/`SbEnvironmentsEdFiService`
  paths produce today (unchanged behavior) — the Bruno assertion simply reports a failed
  test rather than a fabricated success. No special handling needed; this is a
  validation tool, not production code.
- If a captured variable (e.g. `v3SingleEnvId`) is missing because an earlier request
  failed, later requests will 404/error naturally, and their assertions will fail —
  visible to the person running the suite as "step 1 didn't succeed," which is the correct
  signal.

## Testing

- This *is* a testing artifact; there's no meta-test suite for it beyond running it once
  against a local stack with V3 containers up, in both a happy-path run and a rerun (to
  confirm cleanup + safe re-runnability).

## Confirmed Assumptions

- Bruno is the right tool over `.http` files because the target surface is the Admin App
  API itself (JSON bodies, response-chained IDs, `tests{}` assertions), which is exactly
  what the existing `tests/api/collections` folder already models — confirmed by user.
- Full-flow coverage (create single+multi, verify sync, update-resync, manual refresh,
  tenant-lock rejection, cleanup) is wanted, not just a minimal create+verify — confirmed
  by user.
- `ACCESS_TOKEN` acquisition is out of scope; the suite follows the same manual-token
  convention the existing collection already uses.

## Dependencies

- Depends on the V3 single-tenant and multi-tenant Admin API/ODS API containers already
  defined in `compose/` (per AC-524 environment scaffolding) being reachable at
  `https://localhost/odsv7-adminv3-{single,multi}-{adminapi,api}`.
- Depends on the AC-526 implementation itself (`AdminApiVersionStrategy` wiring) being in
  place, which it is (per `526-design.md` and current `AC-526` branch commits).
