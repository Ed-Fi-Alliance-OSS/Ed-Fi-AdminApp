# Certification E2E happy path (proof of concept) - design

Jira: AC-708 "[SIS] - ADMIN APP - Vendor - Investigate E2E tests for the happy path".

## Intent and why

Certification (vendor "My products" dashboard, run, scenarios, steps) has no Playwright coverage.
The ticket asks to investigate what is needed to cover the vendor happy path in an automated way:

1. Create a new certification run.
2. List scenarios.
3. List steps.
4. Execute the steps of a single scenario (School).

Target topology: Admin API v2, single tenant (`odsV7-adminV2-single-*`), ODS/API 7.3.2 with
Data Standard 5.2 and a populated ODS.

The deliverable is a proof of concept that shows the whole path works end to end using the existing
`compose/` stack and the helpers in `eng/testing/`, plus a short list of the resources and gaps found.
It is not a full certification test suite; it proves the approach and leaves a base to extend.

## Goals

- A stack that, started with `eng/testing/run-e2e-ui.ps1`, serves an ODS/API with Data Standard 5.2 and
  populated data.
- A Playwright BDD feature that drives the four acceptance criteria against `FullSingleEnvironmentv2`.
- ODS key/secret for the test obtained automatically through Admin API, no manual step.
- A short findings section (in this doc or the PR) listing what the investigation found: resources used,
  gaps, and what is needed to extend to other scenarios, multi-tenant and other data standards.

## Non-goals

- Coverage of every certification domain/scenario, the reviewer flow (approve, reject, changes),
  the SIS Global Admin dashboard, or Vendor dashboard assertions beyond reaching My products.
- Multi-tenant, Admin API v3, v1/v6 or SQL Server ODS variants.
- Making certification work with ODS that has the context route (`{instanceId}`). That is a known
  product limitation, not something this work fixes.

## Anti-goals

- The PoC must not degrade the existing E2E suites. Moving the stack to Data Standard 5.2 is only
  acceptable if the existing features still pass (or any needed adjustment is small and explicit).
- No secrets (ODS key/secret, Admin API client secret) in logs, reports or committed files.

## Constraints

- Playwright BDD conventions already in the repo: `tests/e2e/<area>-page/*.feature` + `*.steps.ts`,
  page objects in `tests/e2e/pages`, `playwright.config.ts` projects/dependencies, `auth.setup.ts`.
- `tests/e2e/environments-page/environmentv2andApi-setup.feature` already creates the team (`ApiTest`) and
  the environment `FullSingleEnvironmentv2` and waits for the sync. The certification feature depends on
  it, as ownerships does.
- Certification modal only offers environments whose `odsDsVersion` passes `supportsCertification`
  (DS 5.x or higher), so the DS 4 templates used today make the environment invisible.
- A step run needs the user to hold the `certification:run` privilege on the data store as a member of
  the owning team.
- Single-line `.editorconfig` rules, LF endings, and the pre-commit lint apply.

## Approaches considered

- **A. Global switch to Data Standard 5.2 (chosen).** One new ODS image digest and 5.2 templates for the
  whole stack. Simple and consistent, one stack. Risk: every other E2E feature now runs on DS 5.2.
- B. Isolate only v2 single with its own image variable and templates folder. No impact on other
  topologies, but more compose, two sets of templates, drift.
- C. A separate compose override just for certification. Base stack untouched, but two start modes for
  `run-e2e-ui.ps1` and CI.

A was chosen by the user after the trade-offs above were shown. The existing features still need to be
run on the new stack to confirm the risk of A does not materialise.

## Design

### 1. Stack changes (compose and scripts)

- `compose/.env.example`: `ODS_API_TAG_7X` pinned to
  `v7.3.2@sha256:c865f2092994d18eb33f84a36d79bbbfab614dfc32a76e93dd7e9dcb2905e352` (ODS 7.3.2, Data Standard 5).
  The same variable feeds all four ODS API services, as today.
- `compose/edfi-services.yml`: remove `ApiSettings__OdsContextRouteTemplate: '{instanceId}'` from the two
  services that have it (v2 single and v3 single; the multi-tenant ones do not). Certification does not
  support context-route ODS yet.
- `eng/testing/run-e2e-ui.ps1`: the ODS template package is no longer hardcoded to Data Standard 4.0.0.
  New parameters, with defaults pointing at the Ed-Fi Azure Artifacts feed:
  - the Data Standard of the template packages (default `5.2.0`, producing package names
    `EdFi.Suite3.Ods.{Minimal|Populated}.Template.PostgreSQL.Standard.<ds>`), and
  - the package version (default `7.3.20057`), and
  - an override to use an already downloaded SQL file path instead of the feed, for offline use.
  The exact parameter names and whether the override is one parameter or two are left to the builder, but
  the defaults must work with no arguments. The cached file name under `compose/db-backup/` must make the
  Data Standard visible or the cache must be invalidated when parameters change, so a stale 4.0 file is
  never silently reused (this is a real risk: the script skips the download when the file exists, and the
  ODS volume is only initialised once, so existing developer volumes need a documented reset).
- The ODS image digest is also exposed as a script parameter that writes `ODS_API_TAG_7X` into the
  generated `compose/.env` (the script regenerates it from `.env.example`). Default: the value in
  `.env.example`, so no argument changes behaviour.
- Documentation: `eng/testing/README.md` and `compose/readme.md` updated for the new parameters and the
  volume reset.

### 2. ODS credentials through Admin API

A Playwright step (using the `request` API, no browser) creates the credentials the Request
Certification modal asks for, against `https://localhost/odsv7-adminv2-single-adminapi`:

1. `POST /connect/register` (form) to register a client for the test, then `POST /connect/token`
   (client credentials) to get a bearer token.
2. `POST /v2/vendors` to create a vendor.
3. `POST /v2/claimSets/copy` copying the `SIS Vendor` claim set (id found with `GET /v2/claimSets`) to a
   new claim set name.
4. `POST /v2/applications` with the vendor id, the new claim set name, an education organization id that
   exists in the populated ODS and the ODS instance id. Its response carries the key and secret.

The key and secret are kept in memory for the run (a Playwright fixture or world object), never printed.
Endpoint definitions: `Ed-Fi-API-Specifications/api-specifications/management/management-api-2.4.0.yaml`.
Names are made unique per run so reruns do not collide.

If a clean in-Playwright implementation turns out not to work (for example, TLS or token scope trouble),
the fallback is a small helper script under `eng/helpers/` that does the same calls and exports the
values, called by `run-e2e-ui.ps1`. Playwright is the preferred home because the feature then runs on its
own, without the runner.

### 3. Playwright feature

New `tests/e2e/certification-page/certification.feature`, `certification.steps.ts`, and a page object in
`tests/e2e/pages/certification-page.ts`, following the existing patterns. One scenario for the happy path:

- Given the user is logged in and is a member of the team that owns `FullSingleEnvironmentv2` with a role
  that holds the certification privileges.
- When they open My products, request a certification (data store, ODS key/secret, model) and start the run.
- Then the run's Scenarios page lists the scenarios of the catalog.
- When they open the School scenario, its steps are listed.
- And when they execute its steps, each step reports a result and the scenario ends completed.

`playwright.config.ts` gets a project for it that depends on the environment setup project (same as
ownerships/environments).

### 4. Findings

During the PoC, record in this doc (a short "Findings" section appended at the end) the resources used,
what was missing and what it cost: the template feed, the digest, the credential flow, the privilege/role
setup, any selectors that lacked accessible handles, runtime, and the status of the existing features on
the DS 5.2 stack.

## Decided by the user

- Approach A (global move to Data Standard 5.2).
- The ODS digest and the template feed (`EdFi.Suite3.Ods.Populated.Template.PostgreSQL.Standard.5.2.0`,
  version 7.3.20057; the Minimal package of the same name and version also exists).
- Remove `OdsContextRouteTemplate` from the compose.
- Template choices exposed as script parameters, with the feed above as default.
- ODS key/secret through Admin API calls (vendor, claim set based on SIS Vendor, application), from
  Playwright if possible or from a script otherwise.

## Left to the builder

- Parameter names and shape of the template/digest options in `run-e2e-ui.ps1`.
- How to make the cache/volume reset safe and documented.
- Which education organization id and ODS instance id to use for the application (read them from the
  populated ODS or Admin API instead of hardcoding if possible).
- Which Admin API client registration and scope to use for the setup calls.
- Which role/privileges the test user needs; add what is missing to the setup steps.
- Exact selectors, waits and the shape of the page object.
- Which School scenario/steps are in the catalog and how step results are asserted.

## My calls (not discussed with the user)

- The Minimal template also moves to 5.2.0 with the same version, because the init script restores both
  and every ODS database must match the API image.
- The PoC covers the Admin API v2 single tenant environment only.
- Findings are written into this doc rather than a separate file.

## Answers from the builder check

- **Digest and topologies.** The ODS image digest is the one the user supplied (ODS 7.3.2, Data Standard 5).
  Only the six v7 ODS databases use the SQL templates; the v6 topology uses its own image
  (`ODS_DB_TAG_6X`) and is unaffected. Whether the digest runs cleanly on all four v7 API services is
  verified by the PoC when the stack starts; if it does not, fall back to approach B and tell the user.
- **`SIS Vendor` claim set.** `compose/http/v7.http` already creates an application with
  `claimSetName: "SIS Vendor"` and registers/authenticates the Admin API client. Use it as the reference
  for the credential flow. The PoC confirms the claim set exists in the pinned Admin API; if not, stop and
  report it.
- **Education organization id.** `v7.http` uses `educationOrganizationIds: [0]`, and
  `compose/http/seed-education-organizations.http` shows how to seed organizations. The builder reads an
  id that exists in the populated ODS and falls back to seeding if none fits (a call, not a user question).
- **Privileges.** `team.sb-environment.edfi-tenant.ods.certification:read` and `:run` exist in
  `packages/models/src/types/privileges.ts`. The existing setup gives the user the `admin` role in the
  team; the builder checks it holds both privileges and, if not, adds the smallest setup step needed.
- **Minimal template.** The Minimal 5.2.0 package at 7.3.20057 exists in the feed (checked).
- **Feed access.** The Ed-Fi feed download works anonymously (checked), as the script already relies on.

## Decision on step results (user, approved)

The populated ODS already holds education organizations and preloaded data. For the School scenario,
the first two steps are expected to pass and the last two are expected to fail for now: they need an extra
step that changes an address through the schools endpoint. For the PoC, steps must execute and report
a result; asserting the pass/fail outcome per step is limited to what is known (first two pass). The two
failing steps are not asserted as success and are recorded in Findings. Making all steps pass is a later
iteration, once the missing pre-step is understood.

Design approved by the user on 2026-11-23.

## Findings

Recorded after implementing the plan on 2026-11-23.

### Resources used

- **ODS image:** `v7.3.2@sha256:c865f209…` (Data Standard 5) is the active `ODS_API_TAG_7X` in `compose/.env.example`; the
  Data Standard 6 digest stays as a commented option, selected with `-OdsApiTag`. The ODS
  reports data model Ed-Fi `5.2.0` and all four v7 APIs start healthy.
- **Templates:** `EdFi.Suite3.Ods.{Minimal|Populated}.Template.PostgreSQL.Standard.5.2.0` version `7.3.20057`
  from the Ed-Fi feed, the defaults of `run-e2e-ui.ps1` (`-OdsDataStandard 5.2.0 -OdsTemplateVersion 7.3.20057`; Data Standard 4 is
  opt-in with 4.0.0 / 7.3.20068). A `.sql.source` marker next to each file makes a different
  standard or version download again.
- **Admin API flow** (single tenant, no `Tenant` header): `/connect/register`, `/connect/token`,
  `POST /v2/vendors`, `GET /v2/claimSets?name=SIS Vendor`, `POST /v2/applications` (the response carries key
  and secret). Helper: `tests/e2e/core/ods-credentials.ts`.
- **Compose:** `ApiSettings__OdsContextRouteTemplate` removed from the two single-tenant API services.
- **Run script:** `run-e2e-ui.ps1` now sets `CERT_ENABLED=true` in the generated `.env`.

### Deviations from the plan

- **`CERT_ENABLED` was missing from the plan.** With it `false` (the default) the API answers "The run
  couldn't be started" on Start Run. The runtime downloads the Bruno artifact from GitHub at API start-up
  (needs outbound access).
- **No claim-set copy.** A copied claim set answers 403 on every resource for about 2.5 minutes (the ODS
  caches its security metadata), so the application uses the reserved `SIS Vendor` claim set directly.
- **Claim-set lookup by name.** `GET /v2/claimSets` is paged (25); `SIS Vendor` is not always on page one.
- **Education organization id.** `educationOrganizationIds: [0]` gives 403 on `schools`; `255901` (the
  populated template's district) works with the ODS. No seeding was needed.
- **Scenario name.** The UI calls it "Schools" (plural), and the first step asks for a "First school id".
  The feature types `255901001` and `255901044`, schools of the populated template.
- **Status label.** The UI says "Successful", not "Passed".
- **Step list race.** The steps table can show its first row alone for a moment; `stepNames()` waits until
  two reads agree.
- **Rate limit.** `/connect/register` returns 429 after a few registrations in a short time; the helper
  retries (up to 12 times, 10 s apart).

### Privileges and selectors

- The `admin` role in the `ApiTest` team holds the certification privileges: My products shows and Request
  New Certification is enabled. No extra setup step was needed.
- Selectors: the modal fields and buttons have accessible labels (native selects, `Key`, `Secret`,
  `Validate credentials`, `Start Run`, `Open Scenario`, `Execute step`). Only the nav link needed
  `a[title="My products"]`, and the open-run link uses its aria-label (`Open <model> run on <data store>`).
- Secrets: `locator.fill(value)` prints the value in the Allure step title (`Fill "<secret>"`). The page
  object sets the value through `evaluate` instead. A forced-failure run found no key or secret under
  `test-results/`.

### Results

- The feature passes in about 50 s, on a fresh run and on a second run on the same stack (open-run path).
- The full suite on a fresh DS5.2 stack (`stop.ps1 -V`, then `run-e2e-ui.ps1 -SkipV1 -KeepEnvFile
  -OdsDataStandard 5.2.0 -OdsTemplateVersion 7.3.20057`): 173 passed in 9.6 minutes, certification
  feature included.
- One existing check was Data Standard dependent: "View Education Organizations" expected the first Ed-Org to
  be `255901107` (the DS4 template). With 5.2 the first is `255901001` (Grand Bend High School). The check
  now compares the details page with the row that was opened (numeric id, `edfi.*` type) instead of a fixed id.
- Because the defaults of `run-e2e-ui.ps1` are the DS5.2 template and image, a stack needs no extra parameters; for
  the DS6 image pass the matching `-OdsDataStandard` / `-OdsTemplateVersion` and `-OdsApiTag <DS6 digest>`; the
  certification feature is then skipped.
- `npm run build` and `npm run lint:check` pass.
- All four Schools steps report Successful. Steps 3 and 4 (`UPDATE`) first need the school changed through the
  ODS API (`tests/e2e/core/ods-api.ts`); the test does that and asserts the outcome from the run endpoint.

### Needed for multi-tenant and other data standards

- **Multi-tenant:** the `Tenant` header on every Admin API call, per-tenant ODS routes (the context route
  template and instance ids), and a team that owns the multi-tenant environment. The Request New
  Certification modal rejects context-based routing today.
- **Other data standards:** matching template packages and image digest, and the catalog artifact for that
  Data Standard.
- **Fresh state:** the setup projects are not idempotent (membership already exists) and
  `chromium-ownerships` changes the `ApiTest` ownership, so every full rerun needs `stop.ps1 -V`.

## Follow-up: make all Schools steps pass (design, 2026-11-23)

### Why

The PoC only asserts that the first two Schools steps are `Successful`; steps 3 and 4 are accepted as
`Successful` or `Failed`, so the feature does not prove the scenario runs without errors. The goal of this
follow-up is that all four steps end `Successful` and the test asserts it.

### Root cause (read from the `cert` schema after a real run)

Steps 1 and 2 (`CREATE`) read schools `255901001` and `255901044` and store their current values. Steps 3
and 4 (`UPDATE`) read the school again and assert that a field changed:

- step 3, `streetNumberName` must differ from `456 Elm Street` (school `255901001`),
- step 4, `postalCode` must differ from `73334` (school `255901044`).

Both return HTTP 200 and fail only on the assertion (`expected '73334' to not equal '73334'`), because
nothing modifies the school between the read and the update step. A real vendor does that change with their
own system. The test must do it.

### Goals

- All four Schools steps end `Successful`, asserted per step.
- Reruns on the same stack keep passing.

### Non-goals

- Other scenarios or domains; asserting anything in the ODS beyond the changed field.

### Approaches (user picked A)

- **A. Unique value per run (chosen).** Before each `UPDATE` step, the test changes the field to a value
  derived from a per-run suffix. Idempotent; reruns work.
- B. Alternate between two fixed values. Simpler to read, but depends on the state left by the previous run.

### Design

1. New helper `tests/e2e/core/ods-api.ts`, using Playwright `request` (no browser), against
   `https://localhost/odsv7-adminv2-single-api`:
   - `POST /oauth/token` (client credentials with the ODS key/secret) for a bearer token,
   - `GET /data/v3/ed-fi/schools/{id}`, then `PUT` the same body with one field changed, sending the
     `ETag` as `If-Match`. Key, secret and token are never logged or attached; error messages carry only the
     status.
2. In `certification.steps.ts`, steps 3 and 4 are preceded by the change: school `255901001`
   `streetNumberName` to `<original> <suffix>`, school `255901044` `postalCode` to a 5-digit value derived
   from the run suffix and different from the current one. The suffix is generated once per run. The step list
   is mapped by index to keep the existing loop (`UPDATE` steps 3 and 4 know their school and field).
3. Assertions tightened: all four steps `Successful` (replaces "report a result"); the step execution POST
   must answer `ok`; the scenario and the run show their completed state, if the UI exposes one (the builder
   checks which label and records it).
4. The feature text changes to "all steps report Successful".

### Left to the builder

- Exact UI label for scenario completion, and whether the run shows one.
- Whether the changed address value passes the ODS validation (street length, postal code format); adjust
  the derived value if the ODS rejects it.
- Whether the `UPDATE` step needs the new value to also differ from the value captured by the previous run
  step (the PUT happens before it runs, so it should).

### My calls (not discussed with the user)

- The helper reuses the Playwright `request` context and the retry-on-429 idea of `ods-credentials.ts`.
- The `ETag`/`If-Match` is used on the `PUT` to avoid blind overwrites.

### Findings of the follow-up (2026-11-23)

- **Result:** all four Schools steps and the scenario report `Successful`; the feature passes in about 40 s,
  on a first run and on reruns over the same stack (the steps run again each time).
- **`SIS Vendor` cannot write schools.** It holds `Read` only on `educationOrganizations`, so a `PUT` answers
  403. The school changes use a second application on the `Ed-Fi Sandbox` claim set
  (`createOdsCredentials(request, { claimSetName })`).
- **TPDM must be off.** With the TPDM plugin loaded, a school write answers 500
  (`relation "tpdm.schoolextension" does not exist`): the Data Standard 5.2 templates have no TPDM tables.
  `run-e2e-ui.ps1` now sets `TPDM_ENABLED=false` in the generated `compose/.env` (and warns about it with
  `-KeepEnvFile`). No e2e test refers to TPDM. The full suite was not rerun after this change.
- **School id is a GUID.** The helper finds it with `GET /schools?schoolId=<id>`, then `PUT` with the `ETag`
  as `If-Match`.
- **Value strategy:** the default one (street name plus ` E2E-<suffix>`, 5-digit postal code from the suffix)
  was accepted by the ODS; the alternating-values fallback was not needed.
- **Assertions:** every step `Successful`, the execution POST must be `ok`, and the Scenarios page shows the
  scenario `Successful` after going back.
- **Secrets:** a forced-failure run left no ODS key, token or client secret in `test-results/`.
- **Dirty stack:** after a full suite `chromium-ownerships` leaves `ApiTest` without ownership; to run the
  certification feature alone again, restore the ownership or reset the stack (`stop.ps1 -V`).
- **Outcome source:** step and scenario results are asserted from the run endpoint's answer
  (`status: 'success'`, last step `scenarioStatus: 'completed'`), plus the UI rows; on a rerun the rows keep the
  previous run's status until they refetch. The e2e project cannot import `@edanalytics/models`, so the values
  are literals.
- **Known limits (not fixed):** the school changes are keyed by step position (2 and 3); the helper edits
  `addresses[0]`; the street value has no 30-character guard (today 27).
