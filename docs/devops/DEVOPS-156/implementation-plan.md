# DEVOPS-156: implementation plan for the short-term items

**Ticket:** DEVOPS-156 | **Epic:** DEVOPS-154 | **Repo:** `Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp` | **Base:** `main` (`fb63e73`) | **Date:** 2026-11-10 | **Status:** tickets created in Jira on 2026-11-11 (DEVOPS-191 to DEVOPS-199)

Companion to `short-term-items.md` (the item list with Session 1 verdicts). This file groups the agreed items into tickets, one row per ticket, and tracks their progress. Update the **Jira**, **Status** and **PR(s)** columns as work moves; keep the rest stable so the history stays readable.

Rules carried over from the review: one pull request per step where practical, never push to `main`, every new `uses:` pinned to a commit SHA with a version comment, no new secrets without an admin, measure before and after for cache and speed changes.

## 1. Ticket tracking

Status values: `Not started`, `Blocked (decision)`, `In progress`, `PR open`, `Merged`, `Verified`, `Dropped`.

| # | Proposed ticket | Items | Priority | Files / scope | Jira | Status | PR(s) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | Dependency-update PRs that install and pass | S1, S9, S11, S2, S13 | Must (S13) | `.npmrc`, `package.json` (overrides), `.github/dependabot.yml`, `on-pullrequest.yml` (dependency-review step, Docker login guard), `run-e2e-ui.yml` (login), Dependabot secrets (admin) | DEVOPS-191 | Not started | | Decide `fail-on-severity` before the S13 step. Dependabot secrets need an admin; the guard on `github.actor` does not. |
| T2 | PR workflow: parallel jobs and real gates | S21, S23, S20, S24 | Must (S21) | `on-pullrequest.yml`, `packages/fe/project.json`, `package.json` scripts, `.husky/pre-commit` and `lint-staged` config | DEVOPS-192 | Not started | | S20 is Could but lives in the same job as S21; one ticket, three PRs. S24 starts non-blocking. |
| T3 | CI visibility: summaries, annotations, failure digest, health report | S17, S16, S32, S18 | Must (S17) | `on-pullrequest.yml`, `run-e2e-ui.yml`, `after-pullrequest.yml`, `playwright.config.ts`, `README.md`, one new scheduled workflow | DEVOPS-193 | Not started | | S18 is Could; do it last. S17 is advisory only (comment on failure, never blocks). |
| T4 | Pin run-time tools and moving action references | S7, S15, S5 | Should | `on-prerelease.yml`, `on-pullrequest.yml`, `on-merge-or-tag.yml`, `run-e2e-api.yml`, `compose/DB-Ods/Dockerfile` | DEVOPS-194 | Not started | | Versions to pin for `minver-cli`, `@usebruno/cli` and Syft must be read from a recent green run first (S5 note). Closes 8 Scorecard pinning alerts. |
| T5 | Workflow hygiene and security documents | S6, S14, S27 | Should | every workflow (`timeout-minutes`), `copilot-setup-steps.yml` (`branches:`), `after-pullrequest.yml` (`retention-days`), `SECURITY.md`, one new secret-scan job | DEVOPS-195 | Not started | | `SECURITY.md` records the Actions policy answer from T9 when it arrives. |
| T6 | Pre-release workflow: bounded, parallel, concurrency | S3, S8, S28 | Could | `on-prerelease.yml`, `on-merge-or-tag.yml` | DEVOPS-196 | Not started | | S28 is Discuss: implement S3 and S8 first, add concurrency only after Session 2. S8 decision: `ubuntu-latest` everywhere, check the npm build. |
| T7 | Actions cache under control | S29, S22, S31, S30 | Should (S29) | `run-e2e-ui.yml` (Playwright cache), `on-pullrequest.yml` (npm cache restore/save), one new `pull_request: closed` workflow | DEVOPS-197 | Blocked (decision) | | S29 can start now. S22 and S31 wait for Stephen (cache policy). S30 is a trial after S21 and the cache decision. |
| T8 | Clean up unused workflows and dead configuration | S19, S33 | Should | `run-e2e-api.yml`, `on-merge-group-cla.yml`, `release.config.mjs`, `package.json` (`semantic-release`), `docs/repository-architecture.md`, `eng/testing/README.md`, hadolint step in `on-pullrequest.yml` | DEVOPS-198 | Not started | | Team decides: wire or delete the API E2E workflow; keep the CLA shim only if a merge queue (M14) is planned. S33 is Discuss. |
| T9 | Branch rules and Actions policy (admin) | S25, S26 | Should (S25) | Repository rulesets and Actions settings; no files | DEVOPS-199 | Blocked (decision) | | Admin only. S26: validate with Stephen and Robert. |
| — | Deferred, no ticket yet | S4, S10, S12 | — | — | | Dropped / Later | | S4 N/A (developers need the `pre` tag). S10 and S12 after T1 lands. |

## 2. Ticket scope

Each ticket lists the steps in the order they should be merged. "Verify" is what a reviewer checks on the PR run; "Roll back" is how to undo the step on its own.

### T1. Dependency-update PRs that install and pass

Goal: a Dependabot PR goes green on its own in the common case.

| Step | Item | Change | Verify | Roll back |
| --- | --- | --- | --- | --- |
| 1 | S1 | Add `legacy-peer-deps=true` to `.npmrc`. Remove the three `overrides` that duplicate direct dependencies (`axios`, `@nestjs/swagger`, `@eslint/eslintrc`), or set them to the same version as the direct entry. | `npm ci` (without the flag on the command line) succeeds locally and in CI; `npm ls` shows no `EOVERRIDE`. | Revert the commit. |
| 2 | S9, S11 | In `dependabot.yml`: add an `nx` group (`nx`, `@nx/*`), `open-pull-requests-limit`, `cooldown`; add `docker` (directories `/packages/api`, `/packages/fe`, `/compose/DB-Ods`) and `github-actions` ecosystems, weekly, grouped. | The next weekly run opens grouped PRs; the `@nx/*` PR bumps all plugins together; `docker` and `github-actions` PRs appear. | Revert the file. |
| 3 | S2 | Either create `DOCKER_HUB_USERNAME` and `DOCKER_HUB_TOKEN` in the Dependabot secret store (admin), or add `if: github.actor != 'dependabot[bot]'` to the `docker/login-action` steps in `on-pullrequest.yml` and `run-e2e-ui.yml`. | A bot PR run shows no `Password required`; the E2E job starts the stack. | Remove the `if:` lines or the secrets. |
| 4 | S13 | Configure `dependency-review-action`: `fail-on-severity` (team decision, `high` proposed), `comment-summary-in-pr: always`, optional `allow-licenses` or `deny-licenses`. | The PR shows the dependency-review comment; a known low-severity test dependency does not block. | Revert the step options. |

Evidence to collect before and after: failure rate of `On Pull Request` runs triggered by `dependabot[bot]`, and the count of bot PRs closed unmerged (commands in `short-term-items.md` sources, review section 4.1).

### T2. PR workflow: parallel jobs and real gates

Goal: PR checks run in parallel and every gate can actually fail.

| Step | Item | Change | Verify | Roll back |
| --- | --- | --- | --- | --- |
| 1 | S21 | Remove `needs: setup` from `lint` and the Docker job, `needs: lint` from `build_and_test`; delete the `setup` job (or keep it as a cache warmer nothing waits for). | Jobs start together after checkout; PR median duration drops by about 2 minutes against the baseline. | Restore the `needs:` edges. |
| 2 | S20 | Remove the `prettier:write` step so only `prettier:check` runs. Add an ESLint job (`npm run lint:check` or `nx run-many -t lint` with `--max-warnings 0`). Add `common-ui` to the build-and-test matrix. | A deliberately unformatted file fails the Prettier job; the ESLint job runs; `common-ui` tests appear in the test report. | Revert per step. |
| 3 | S23 | Add a `typecheck` target to `packages/fe/project.json` (`tsc --noEmit -p packages/fe/tsconfig.app.json`) and run it in the PR workflow. | A deliberate type error in `packages/fe` fails the job. | Remove the target and the step. |
| 4 | S24 | Add a job on PRs touching `.github/` that runs `actionlint` and `zizmor` (official actions, SHA-pinned), `continue-on-error: true` at first; add both to `lint-staged` for `.github/**`. | The job runs on a PR that edits a workflow and reports the current backlog. | Remove the job. |

### T3. CI visibility

Goal: a reviewer sees test counts, failures and image sizes without opening logs.

| Step | Item | Change | Verify | Roll back |
| --- | --- | --- | --- | --- |
| 1 | S16 | Append a Markdown block to `$GITHUB_STEP_SUMMARY` in each PR and E2E job: unit-test counts per package, E2E pass/fail/flaky, image sizes, audit summary. | The run page shows the summaries. | Remove the steps. |
| 2 | S32 | Add the Playwright `github` reporter in `playwright.config.ts` (keep JUnit and Allure); add the Scorecard badge to `README.md`. | An E2E failure is annotated on the PR diff; the badge renders. | Revert both. |
| 3 | S17 | Add an advisory job on `workflow_run` failure that extracts the `##[error]` lines from `gh run view --log-failed`, matches them against the known patterns (sync timeout, Docker Hub password, lock-file drift) and posts one PR comment, updated in place. | A failing bot PR receives the comment; a green run posts nothing. | Remove the job. |
| 4 | S18 | Add a weekly scheduled workflow (or a script under `eng/`) that runs the review's `gh` queries (median and p90 duration per workflow, failure rate by actor, queue time, cache usage, open alerts) into a job summary. | The first run reproduces the baseline table from the review. | Remove the workflow. |

### T4. Pin run-time tools and moving action references

Goal: nothing in CI changes unless a commit in this repo changes it.

| Step | Item | Change | Verify | Roll back |
| --- | --- | --- | --- | --- |
| 1 | S7 | Pin to a commit SHA with a version comment: `repository-scanner.yml@main` (required check), `secure-download-artifact@main`, `setup-node@v4` (2 places), `upload-artifact@v4` (2), `download-artifact@v4` (2) in `on-prerelease.yml` and `on-pullrequest.yml`. | Workflows still run; `grep -nE "uses: .*@(main|master|v[0-9]+)" .github/workflows/*.yml` returns nothing. | Revert the file. |
| 2 | S5 | Pin `minver-cli` (`dotnet tool install --global minver-cli --version <x.y.z>`, in `on-prerelease.yml` and `on-merge-or-tag.yml`), `@usebruno/cli@<x.y.z>` in `run-e2e-api.yml`, Syft via `anchore/sbom-action` at a SHA or the install script with an explicit version and checksum, and `tonistiigi/binfmt` by digest. Versions come from a recent green run log. | A pre-release run produces the same version number and SBOM as before. | Revert per tool. |
| 3 | S15 | Pin `postgres:16-alpine` by digest in `compose/DB-Ods/Dockerfile` (DF1). | The E2E stack starts; Scorecard's next weekly run closes the `PinnedDependenciesID` alerts. | Revert the `FROM` line. |

Dependency: the Dependabot `docker` and `github-actions` ecosystems from T1 step 2 keep these pins fresh afterwards.

### T5. Workflow hygiene and security documents

| Step | Item | Change | Verify | Roll back |
| --- | --- | --- | --- | --- |
| 1 | S6 | `timeout-minutes` on every job (15 lint and build, 30 E2E, 60 publish); `retention-days: 7` on the Event File upload; `branches:` filter on `copilot-setup-steps.yml`. | `grep -c timeout-minutes .github/workflows/*.yml` is non-zero for every file; the Copilot workflow stops running on tag pushes. | Revert per file. |
| 2 | S27 | Add a `gitleaks` (or `trufflehog`) job on pull requests scanning the diff, SHA-pinned. | The job runs in seconds on a PR; a test string in a scratch branch is caught. | Remove the job. |
| 3 | S14 | Rewrite `SECURITY.md` for this repo: TypeScript CodeQL on PR and `main`, Dependabot, Scorecard, how to report privately, and the Actions policy once T9 confirms it. | Reviewed by the team. | Revert the file. |

### T6. Pre-release workflow

| Step | Item | Change | Verify | Roll back |
| --- | --- | --- | --- | --- |
| 1 | S3 | `timeout-minutes` on every job of `on-prerelease.yml` (60 for the publish); turn the sequential api and fe builds into a matrix (`api`, `fe`) with `fail-fast: false`. | A pre-release finishes in less than the sum of the two builds; a hang ends within the limit. | Restore the sequential steps. |
| 2 | S8 | Replace `ubuntu-22.04` on `pack` with `ubuntu-latest` (decision from Session 1); add `cache: npm` to the `validate` job. Check the npm build on the current image. | `pack` and `validate` pass on `ubuntu-latest`. | Restore the pin. |
| 3 | S28 | After Session 2 only: `concurrency: { group: prerelease, cancel-in-progress: false }` on `on-prerelease.yml` and `on-merge-or-tag.yml`. | Two quick merges queue instead of running two publishes. | Remove the block. |

The MinVer replacement (compute the version in Node or with `git describe`) stays with L2 and is not part of this ticket.

### T7. Actions cache under control

| Step | Item | Change | Verify | Roll back |
| --- | --- | --- | --- | --- |
| 1 | S29 | Cache `~/.cache/ms-playwright` with `actions/cache`, keyed on the Playwright version from `package-lock.json`; keep `--with-deps` for OS packages. Trial on one job. | "Install Playwright browser dependencies" drops from about 20 s to a few seconds on a cache hit. | Remove the cache step. |
| 2 | S22, S31 | After Stephen's answer: `actions/cache/restore` on PRs and `actions/cache/save` on `main` (or key on the lock-file hash alone); a `pull_request: closed` workflow that runs `gh cache delete` for the PR's refs. | Cache usage stays under 10 GB; `main` entries are not evicted. | Revert both. |
| 3 | S30 | Trial: `.nx/cache` in `actions/cache`, keyed on the lock file and source hash, restore-only on PRs. Compare build step times before and after. | Measured gain, or the step is dropped. | Remove the step. |

### T8. Clean up unused workflows and dead configuration

| Step | Item | Change | Verify | Roll back |
| --- | --- | --- | --- | --- |
| 1 | S19 | With the team's decision: delete or wire `run-e2e-api.yml` (and fix the `api-bruno-e2e.yml` name in `eng/testing/README.md`); delete `on-merge-group-cla.yml` unless a merge queue is planned; remove `release.config.mjs` and `semantic-release` unless chosen as the versioning tool; fix `docs/repository-architecture.md`. | The workflow list in the Actions tab matches what runs; `npm ci` has one fewer dependency. | Revert per file. |
| 2 | S33 | After Session 2: run hadolint from `docker://hadolint/hadolint@sha256:...` instead of building the action. | The "Build hadolint/hadolint-action" step disappears from the Docker Analysis job. | Revert the step. |

### T9. Branch rules and Actions policy (admin)

| Step | Item | Change | Verify | Roll back |
| --- | --- | --- | --- | --- |
| 1 | S25 | In the `main` ruleset: dismiss stale reviews on push, require conversation resolution, add the `code_scanning` rule (block on open high alerts); decide on signed commits. | Ruleset JSON shows the three settings. | Settings change. |
| 2 | S26 | Stephen and Robert confirm: default `GITHUB_TOKEN` read-only, "Allow GitHub Actions to create and approve pull requests" off, allowed actions limited to GitHub, verified creators and the Ed-Fi org. Record the answer in `SECURITY.md` (T5 step 3). | Answer recorded. | n/a |

## 3. Sequence

```text
Week of Nov 10   T1 steps 1-2 (Dependabot config)      T2 step 1 (S21, parallel jobs)      T4 step 1 (S7 pins)
Week of Nov 17   T1 steps 3-4 (login guard, S13)        T2 steps 2-3 (lint gates, typecheck) T5 step 1 (timeouts)
Week of Nov 24   T3 steps 1-2 (summaries, reporter)     T4 steps 2-3 (tool pins, digest)    T7 step 1 (Playwright cache)
Week of Dec 1    T3 step 3 (failure digest)             T2 step 4 (actionlint, zizmor)      T6 steps 1-2 (pre-release)
After Session 2  T6 step 3, T7 steps 2-3, T8, T9, T3 step 4, deferred items
```

Dependencies worth keeping in mind:

- T1 step 2 (Dependabot `github-actions` and `docker`) should land before or with T4, so the new pins are refreshed by PR.
- T2 step 1 (S21) changes the job graph; land it before T3 step 1 adds summaries to those jobs, to avoid editing the same lines twice.
- T7 steps 2 and 3 and T6 step 3 wait for conversations (Stephen; Session 2).
- T5 step 3 (`SECURITY.md`) is best written after T9 step 2 answers the policy question, but can be drafted earlier with a placeholder.

## 4. Decisions needed before starting

| # | Decision | Owner | Blocks |
| --- | --- | --- | --- |
| D1 | `fail-on-severity` level and license rules for dependency-review (S13). | Dev team | T1 step 4 |
| D2 | Versions to pin for `minver-cli`, `@usebruno/cli`, Syft (S5). Read from a recent green pre-release log. | DevOps | T4 step 2 |
| D3 | Cache save/restore policy and PR cache deletion (S22, S31). | Stephen | T7 steps 2-3 |
| D4 | Actions policy confirmation (S26). | Stephen, Robert | T9 step 2, T5 step 3 |
| D5 | Fate of `run-e2e-api.yml`, the CLA shim and `semantic-release` (S19). | Dev team | T8 step 1 |
| D6 | Concurrency on the release path (S28), Nx local cache trial (S30), hadolint image (S33). | Session 2 | T6 step 3, T7 step 3, T8 step 2 |

## 5. Item-to-ticket index

| Item | Ticket | Item | Ticket | Item | Ticket |
| --- | --- | --- | --- | --- | --- |
| S1 | T1 | S12 | Deferred | S23 | T2 |
| S2 | T1 | S13 | T1 | S24 | T2 |
| S3 | T6 | S14 | T5 | S25 | T9 |
| S4 | Deferred (N/A) | S15 | T4 | S26 | T9 |
| S5 | T4 | S16 | T3 | S27 | T5 |
| S6 | T5 | S17 | T3 | S28 | T6 |
| S7 | T4 | S18 | T3 | S29 | T7 |
| S8 | T6 | S19 | T8 | S30 | T7 |
| S9 | T1 | S20 | T2 | S31 | T7 |
| S10 | Deferred | S21 | T2 | S32 | T3 |
| S11 | T1 | S22 | T7 | S33 | T8 |

## 6. Change log

| Date | Change |
| --- | --- |
| 2026-11-10 | First draft from the Session 1 verdicts. No Jira tickets created yet. |
| 2026-11-11 | Ticket texts drafted in `jira-tickets-draft.md` (T1 to T9), pending review before publishing to Jira. |
| 2026-11-11 | Draft reviewed and published: T1 to T9 created as DEVOPS-191 to DEVOPS-199 under epic DEVOPS-154. Jira column filled. |
| 2026-11-12 | Confluence page "Ed-Fi-AdminApp CI/CD Review: Findings and Proposal" published next to the ODS-Admin-API one (OTD space, under "1. Roadmap - Improve GitHub Actions Workflows"), with the S/M/L catalogue, Session 1 status and the nine tickets. |
