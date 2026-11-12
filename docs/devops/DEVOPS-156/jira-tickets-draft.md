# DEVOPS-156: Jira ticket drafts (short-term items)

**Status:** PUBLISHED 2026-11-11. Tickets DEVOPS-191 to DEVOPS-199 were created from this text; cross-references by T-number were replaced with Jira keys in Jira. Edit the tickets in Jira from now on; this file is the record of what was published.
**Date:** 2026-11-11 | **Project:** DEVOPS | **Issue type:** Task | **Parent (epic):** DEVOPS-154 "Improve GitHub Actions Workflows" | **Repo:** `Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp`

Format follows DEVOPS-162 (the ODS-Admin-API ticket): Context, Rules, How to gather evidence, How to fix, Acceptance criteria. One ticket per group T1 to T9 from `implementation-plan.md`. Review notes go in the "Review" line under each ticket; once approved, the summary and description are published as written and the Jira key is copied into the plan's tracking table.

Common rules, repeated in every ticket:

* Evidence commands are read-only. Run them first and record the numbers in the ticket before changing anything.
* One pull request per step where practical. Never push to `main`.
* Every new `uses:` line is pinned to a commit SHA with a version comment.
* No new secrets and no permission beyond what the ticket names without approval from the security owner.

Every evidence block assumes:

```bash
export R=Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp
```

## Index

| # | Proposed summary | Items | Priority |
| --- | --- | --- | --- |
| T1 (DEVOPS-191) | Ed-Fi-AdminApp: Make dependency-update PRs install and pass on their own (S1, S9, S11, S2, S13) | S1, S9, S11, S2, S13 | Must (S13); S1, S2, S9, S11 Should |
| T2 (DEVOPS-192) | Ed-Fi-AdminApp: PR workflow: run jobs in parallel and make the lint, type and workflow gates real (S21, S20, S23, S24) | S21, S20, S23, S24 | Must (S21); S23, S24 Should; S20 Could |
| T3 (DEVOPS-193) | Ed-Fi-AdminApp: CI visibility: run summaries, PR annotations, failure digest and health report (S17, S16, S32, S18) | S17, S16, S32, S18 | Must (S17); S16, S32 Should; S18 Could |
| T4 (DEVOPS-194) | Ed-Fi-AdminApp: Pin run-time tools and moving action references flagged by Scorecard (S7, S15, S5) | S7, S15, S5 | Should |
| T5 (DEVOPS-195) | Ed-Fi-AdminApp: Workflow hygiene: job timeouts, artifact retention, trigger filter, secret scan and SECURITY.md (S6, S27, S14) | S6, S27, S14 | Should |
| T6 (DEVOPS-196) | Ed-Fi-AdminApp: Pre-release workflow: bounded, parallel image builds on ubuntu-latest (S3, S8, S28) | S3, S8, S28 | Could; S28 Discuss (after Session 2) |
| T7 (DEVOPS-197) | Ed-Fi-AdminApp: Actions cache under control: Playwright browsers, npm cache policy, PR cache cleanup, Nx cache trial (S29, S22, S31, S30) | S29, S22, S31, S30 | Should (S29); S22, S30, S31 Could; S22 and S31 wait for Stephen |
| T8 (DEVOPS-198) | Ed-Fi-AdminApp: Clean up unused workflows and dead configuration (S19, S33) | S19, S33 | Should (S19); S33 Discuss |
| T9 (DEVOPS-199) | Ed-Fi-AdminApp: Tighten the main ruleset and confirm the repository Actions policy (admin) (S25, S26) | S25, S26 | Should (S25); S26 Discuss, validate with Stephen and Robert |
| — | No ticket: S4 (N/A), S10 and S12 (Later) | S4, S10, S12 | — |

---

## T1 (DEVOPS-191). Ed-Fi-AdminApp: Make dependency-update PRs install and pass on their own (S1, S9, S11, S2, S13)

**Issue type:** Task | **Parent:** DEVOPS-154 | **Priority (Jira):** Medium | **Labels:** none | **Review:** approved 2026-11-11

### Context

Part of the Ed-Fi-AdminApp CI/CD review (DEVOPS-156, epic DEVOPS-154). Repo: `Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp`, default branch `main`. Items S1, S9, S11, S2, S13 from the review; verdicts and priorities from Session 1 with the developers (2026-11-09 and 2026-11-10).

* Dependabot's own updater fails because CI installs with `npm ci --legacy-peer-deps` on the command line while `.npmrc` only has `engine-strict=true`; Dependabot runs npm with what `.npmrc` says, so peer conflicts fail the update or produce a lock file the PR's `npm ci` rejects (`EUSAGE`). Three packages (`axios`, `@nestjs/swagger`, `@eslint/eslintrc`) are both direct dependencies and `overrides`, which throws `EOVERRIDE` when the bot bumps one. Evidence at review time: 22 of 69 updater jobs failed, 72 of 200 bot PRs closed unmerged.
* `dependabot.yml` only watches `npm`, groups minor and patch updates, and has no `nx` group, no `open-pull-requests-limit` and no `cooldown`. Nx plugins must match the `nx` version exactly, so four separate `@nx/*` major PRs were open at once, each failing with `Unable to resolve @nx/vite:build` and each starting about 12 jobs. Base-image digests and action SHAs are refreshed by hand (PR #361).
* A run triggered by `dependabot[bot]` only receives the Dependabot secret store, which is empty, so `docker/login-action` runs with an empty password (`Password required` in 12 runs) and the Docker Analysis and E2E jobs fail before testing anything. Session 1 note: Docker login is not implemented; push/pull rate limit. (Admin API has the same gap; recorded separately for ODS-Admin-API.)
* `dependency-review-action` runs with defaults: `fail-on-severity: low`, no PR comment, no license policy. 8 bot PR failures came from it; the `zod` high finding was legitimate but the policy is implicit.
* Session 1: S13 Must; S1, S2, S9, S11 Should. Keep Docker Scout on the Docker Analysis job (S11 note).

### Rules for whoever works this ticket (human or LLM)

* Evidence commands are read-only. Run them first and record the numbers here before changing anything.
* One pull request per step where practical. Never push to `main`.
* New `uses:` lines are pinned to a commit SHA with a version comment.
* Do not widen permissions beyond what this ticket names. Do not add secrets without approval from the security owner.

### How to gather evidence

```bash
export R=Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp

# S1: Reliability
grep -n "legacy-peer-deps" .npmrc .github/workflows/*.yml
grep -n -A2 '"overrides"' package.json | head -4; grep -nE '"(axios|@nestjs/swagger|@eslint/eslintrc)"' package.json
gh run list -R $R --workflow "Dependabot Updates" --limit 70 --json conclusion -q 'group_by(.conclusion)|map("\(.[0].conclusion) \(length)")|.[]'
gh api "repos/$R/actions/workflows/on-pullrequest.yml/runs?per_page=100&status=completed" --jq '[.workflow_runs[]|select(.triggering_actor.login=="dependabot[bot]")]|group_by(.conclusion)|map("bot PR runs \(.[0].conclusion): \(length)")|.[]'

# S9: Runners
cat .github/dependabot.yml
gh pr list -R $R --author app/dependabot --state open --json title,createdAt -q '.[]|"\(.createdAt[:10]) \(.title)"'

# S11: Security
grep -n "package-ecosystem" .github/dependabot.yml
grep -n "^FROM" packages/api/Dockerfile packages/fe/Dockerfile compose/DB-Ods/Dockerfile
gh pr view 361 -R $R --json title,mergedAt -q '"\(.mergedAt[:10]) \(.title)"'

# S2: Reliability
gh api repos/$R/dependabot/secrets --jq .total_count
grep -n -B2 -A4 "docker/login-action" .github/workflows/on-pullrequest.yml .github/workflows/run-e2e-ui.yml
id=$(gh api "repos/$R/actions/workflows/on-pullrequest.yml/runs?per_page=100&status=failure" --jq '[.workflow_runs[]|select(.triggering_actor.login=="dependabot[bot]")][0].id'); echo "failed bot run $id"; gh run view $id -R $R --log-failed 2>/dev/null | grep -i -m3 "password required\|Username and password"

# S13: Security
grep -n -B2 -A8 "dependency-review-action" .github/workflows/on-pullrequest.yml
```

### How to fix

1. **S1:** add `legacy-peer-deps=true` to `.npmrc`. Remove the three `overrides` that duplicate direct dependencies, or set them to the same version as the direct entry. Run `npm ci` without the flag on the command line locally and confirm `npm ls` reports no `EOVERRIDE`. Keep `--legacy-peer-deps` in the workflows until the next Dependabot run proves `.npmrc` is enough, then drop it.
2. **S9 + S11:** in `.github/dependabot.yml` add an `nx` group (`nx`, `@nx/*`), `open-pull-requests-limit` (5 proposed), `cooldown` (3 days proposed), and a `major` group or schedule; add `docker` (directories `/packages/api`, `/packages/fe`, `/compose/DB-Ods`) and `github-actions` ecosystems, weekly, grouped. Record the next weekly run's outcome in this ticket.
3. **S2:** choose one: (a) an admin creates `DOCKER_HUB_USERNAME` and `DOCKER_HUB_TOKEN` in the Dependabot secret store, or (b) guard the `docker/login-action` steps in `on-pullrequest.yml` and `run-e2e-ui.yml` with `if: github.actor != 'dependabot[bot]'`. Option (b) needs no admin; the E2E stack pulls public images, so the login only avoids the anonymous rate limit. Keep the 3-attempt pull retry from PR #425.
4. **S13:** set `fail-on-severity` (team decision, `high` proposed), `comment-summary-in-pr: always`, and `allow-licenses` or `deny-licenses` if the team wants a license rule; add `pull-requests: write` to that job only. Keep the check blocking.

### Acceptance criteria

* `npm ci` with no command-line flag installs cleanly from the lock file; `npm ls` shows no `EOVERRIDE`.
* The first weekly Dependabot run after the change opens grouped PRs (one `nx` PR bumps all `@nx/*` together), plus `docker` and `github-actions` PRs, and the updater job log shows no lock-file or peer-dependency error.
* A Dependabot PR run shows no `Password required`; its E2E job starts the stack.
* A Dependabot PR shows the dependency-review summary comment; the configured severity is visible in the workflow file.
* No new write permission beyond `pull-requests: write` on the dependency-review job; no secret added without an admin.
* Baseline and after numbers recorded in this ticket: failure rate of `On Pull Request` runs by `dependabot[bot]`, open bot PRs, Dependabot Updates run conclusions.

---

## T2 (DEVOPS-192). Ed-Fi-AdminApp: PR workflow: run jobs in parallel and make the lint, type and workflow gates real (S21, S20, S23, S24)

**Issue type:** Task | **Parent:** DEVOPS-154 | **Priority (Jira):** Medium | **Labels:** none | **Review:** approved 2026-11-11

### Context

Part of the Ed-Fi-AdminApp CI/CD review (DEVOPS-156, epic DEVOPS-154). Repo: `Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp`, default branch `main`. Items S21, S20, S23, S24 from the review; verdicts and priorities from Session 1 with the developers (2026-11-09 and 2026-11-10).

* `on-pullrequest.yml` chains `setup -> lint -> build_and_test`, but the jobs share no files: each one checks out and runs `npm ci` again (nine installs per run). The `setup` job installs dependencies no later job uses. Critical path at review time: 52 + 70 + 131 s against 138 s for the longest single job, about 2 minutes of waiting on a 4.4 minute median.
* The lint job runs `prettier:write` and then `prettier:check`, so the check can never fail. ESLint runs only in the Husky pre-commit hook, which `--no-verify` skips. The `common-ui` package is not in the build-and-test matrix, so its 3 spec files never run in CI.
* The frontend builds with `@nx/vite:build`, which transpiles with esbuild and never type-checks; only api, utils and models go through `tsc`. There is no `typecheck` target in any `project.json`.
* Nothing lints the workflow files. `actionlint` and `zizmor` flag unpinned `@main` references, over-broad permissions and template-injection risks automatically; several findings of this review are exactly what they report.
* Session 1: S21 Must, S23 and S24 Should, S20 Could. S20 is grouped here because it edits the same job as S21.

### Rules for whoever works this ticket (human or LLM)

* Evidence commands are read-only. Run them first and record the numbers here before changing anything.
* One pull request per step where practical. Never push to `main`.
* New `uses:` lines are pinned to a commit SHA with a version comment.
* Do not widen permissions beyond what this ticket names. Do not add secrets without approval from the security owner.

### How to gather evidence

```bash
export R=Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp

# S21: Speed
grep -n "needs:" .github/workflows/on-pullrequest.yml
grep -c "npm ci" .github/workflows/on-pullrequest.yml
id=$(gh run list -R $R --workflow "On Pull Request" --status success --limit 1 --json databaseId -q '.[0].databaseId'); gh run view $id -R $R --json jobs -q '.jobs[]|select(.name=="Setup" or .name=="Prettier Check")|"\(.name) \(.startedAt) \(.completedAt)"'

# S20: Quality gate
grep -n -B1 -A3 "prettier" .github/workflows/on-pullrequest.yml | head -20
grep -n "eslint" .github/workflows/*.yml || echo "ESLint not in CI"
grep -nE '"(lint|prettier:check|prettier:write|test)[^"]*"' package.json
grep -n -A6 "matrix:" .github/workflows/on-pullrequest.yml | grep -n "package" ; cat .husky/pre-commit

# S23: Quality gate
grep -n '"executor"' packages/fe/project.json | head -3
grep -rn "typecheck\|tsc --noEmit" packages/*/project.json nx.json package.json || echo "no typecheck target"

# S24: Quality gate
grep -rn "actionlint\|zizmor" .github package.json .husky 2>/dev/null || echo "no workflow linter"
# optional, needs the tools installed: actionlint; uvx zizmor .github/workflows
```

### How to fix

1. **S21:** remove `needs: setup` from `lint` and the Docker job and `needs: lint` from `build_and_test`; delete the `setup` job (or keep it as a cache warmer nothing waits for). Compare the PR median duration against the baseline.
2. **S20:** delete the `prettier:write` step; add an ESLint job (`npm run lint:check`, or `nx run-many -t lint` with `--max-warnings 0`); add `common-ui` to the matrix. Fix the current ESLint and Prettier backlog in the same PR or in a preceding one, so the new gate starts green.
3. **S23:** add a `typecheck` target to `packages/fe/project.json` running `tsc --noEmit -p packages/fe/tsconfig.app.json`; run it in the PR workflow next to lint. Fix the type backlog first if any.
4. **S24:** add a job on PRs touching `.github/**` that runs `actionlint` and `zizmor` through their official actions, SHA-pinned, with `continue-on-error: true` until the backlog is empty; add both to `lint-staged` for the same paths.
5. Do not add the gate to the ruleset here; the single required `gate` job is L3.

### Acceptance criteria

* All PR jobs start right after checkout; no job has `needs: setup` or `needs: lint`; PR median duration is recorded before and after.
* A deliberately unformatted file fails the Prettier job; a deliberate ESLint warning fails the lint job; `common-ui` test results appear in the test report.
* A deliberate type error in `packages/fe` fails the `typecheck` job; `nx run fe:typecheck` works locally.
* A PR that edits a workflow file runs `actionlint` and `zizmor`, and their findings are visible in the job log or summary.
* No existing job loses coverage (same packages built and tested as before, plus `common-ui`).

---

## T3 (DEVOPS-193). Ed-Fi-AdminApp: CI visibility: run summaries, PR annotations, failure digest and health report (S17, S16, S32, S18)

**Issue type:** Task | **Parent:** DEVOPS-154 | **Priority (Jira):** Medium | **Labels:** none | **Review:** approved 2026-11-11

### Context

Part of the Ed-Fi-AdminApp CI/CD review (DEVOPS-156, epic DEVOPS-154). Repo: `Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp`, default branch `main`. Items S17, S16, S32, S18 from the review; verdicts and priorities from Session 1 with the developers (2026-11-09 and 2026-11-10).

* Jest and Playwright produce JUnit results and `After Pull Request` publishes a check, but no run writes a job summary. To learn how many tests ran, which E2E scenario failed or how big the images are, a reviewer opens a 13-minute log.
* Allure and JUnit are uploaded as artifacts but failures are not annotated on the PR diff. The Scorecard result is only visible in the Security tab.
* Many failures are repeats (sync timeout in `environmentv2andApi.feature`, Docker Hub password, lock-file drift), so the same diagnosis is redone by hand on every red run.
* The numbers in the review (durations, failure rate by actor, queue, cache usage) were produced once by hand with `gh`; without a repeatable report nobody can tell whether a change helped.
* Session 1: S17 Must, S16 and S32 Should, S18 Could (do last).

### Rules for whoever works this ticket (human or LLM)

* Evidence commands are read-only. Run them first and record the numbers here before changing anything.
* One pull request per step where practical. Never push to `main`.
* New `uses:` lines are pinned to a commit SHA with a version comment.
* Do not widen permissions beyond what this ticket names. Do not add secrets without approval from the security owner.

### How to gather evidence

```bash
export R=Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp

# S17: Innovation
gh api "repos/$R/actions/workflows/run-e2e-ui.yml/runs?per_page=100&status=failure" --jq '.workflow_runs|group_by(.triggering_actor.login)|map("E2E failures by \(.[0].triggering_actor.login): \(length)")|.[]'

# S16: Innovation
grep -rn "GITHUB_STEP_SUMMARY" .github/workflows/*.yml || echo "no step summaries"
grep -n "jest-junit\|junit" packages/*/jest.config.ts playwright.config.ts | head

# S32: Reports
grep -n -A5 "reporter:" playwright.config.ts
grep -n -i "scorecard\|badge" README.md || echo "no Scorecard badge in README"

# S18: Innovation
gh run list -R $R --workflow "On Pull Request" --limit 200 --json createdAt,updatedAt,conclusion -q '[.[]|select(.conclusion=="success")|((.updatedAt|fromdate)-(.createdAt|fromdate))/60]|sort|"median \(.[length/2|floor]|.*10|round/10) min over \(length) runs"'
gh api repos/$R/actions/cache/usage --jq '"cache \(.active_caches_size_in_bytes/1e9|.*100|round/100) GB in \(.active_caches_count) entries"'
```

### How to fix

1. **S16:** in each PR and E2E job, append a short Markdown block to `$GITHUB_STEP_SUMMARY`: unit-test counts per package (from the JUnit files), E2E pass/fail/flaky counts, image sizes from `docker image ls`, dependency-review or audit summary when available. No new tools.
2. **S32:** add the Playwright `github` reporter in `playwright.config.ts`, keeping JUnit and Allure; add the Scorecard badge to `README.md`.
3. **S17:** add an advisory job triggered on `workflow_run` failure of `On Pull Request` and `UI Playwright E2E` that reads `gh run view --log-failed`, extracts the `##[error]` lines, classifies them against the known patterns (sync timeout, Docker Hub password, lock-file drift, dependency-review) and posts one PR comment updated in place (marker comment). Guard bot and fork PRs: their token is read-only, so make the comment step `continue-on-error: true`. `pull-requests: write` on that job only. Optionally ask a model to summarise; start with the pattern list.
4. **S18:** a weekly scheduled workflow (or a script under `eng/`) that runs the review's `gh` queries (median and p90 duration per workflow, failure rate by actor, queue time, cache usage, open alerts) and writes them to a job summary or a tracking issue. The first run must reproduce the baseline table from the review.

### Acceptance criteria

* The run page of a PR and of an E2E run shows test counts, E2E results and image sizes without opening logs.
* An E2E failure appears as an annotation on the PR diff; the README shows the Scorecard badge.
* A failing PR run receives one comment with the failure category and the first error lines; a second failure updates the same comment; a green run posts nothing; a Dependabot PR run does not fail because of the comment step.
* The weekly health report runs and its first output matches the review baseline within the expected drift.
* No write permission beyond `pull-requests: write` on the digest job.

---

## T4 (DEVOPS-194). Ed-Fi-AdminApp: Pin run-time tools and moving action references flagged by Scorecard (S7, S15, S5)

**Issue type:** Task | **Parent:** DEVOPS-154 | **Priority (Jira):** Medium | **Labels:** none | **Review:** approved 2026-11-11

### Context

Part of the Ed-Fi-AdminApp CI/CD review (DEVOPS-156, epic DEVOPS-154). Repo: `Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp`, default branch `main`. Items S7, S15, S5 from the review; verdicts and priorities from Session 1 with the developers (2026-11-09 and 2026-11-10).

* Several `uses:` references follow a moving target: `repository-scanner.yml@main` (the required BIDI check), `secure-download-artifact@main`, and `setup-node@v4`, `upload-artifact@v4`, `download-artifact@v4` (two places each) in `on-prerelease.yml`. A force-push or compromised tag upstream changes what runs here with no review.
* Three tools are installed at run time from moving sources: Syft via `curl ... | sh` from its `main` install script, `minver-cli` as a .NET global tool with no `--version` (in `on-prerelease.yml` and `on-merge-or-tag.yml`), `@usebruno/cli` with `npm install -g` and no version (`run-e2e-api.yml`); `tonistiigi/binfmt:latest` is pulled by tag. A new upstream release changes the SBOM, the version number or the test runner without a commit here.
* `compose/DB-Ods/Dockerfile` uses `postgres:16-alpine` without a digest (DF1).
* Scorecard reports 8 medium `PinnedDependenciesID` alerts for exactly these lines.
* Session 1: all three Should. S5 note: check how the dotnet tool CLI pins versions (`dotnet tool install --global minver-cli --version <x.y.z>`); the version to pin must be read from a recent green pre-release log.

### Rules for whoever works this ticket (human or LLM)

* Evidence commands are read-only. Run them first and record the numbers here before changing anything.
* One pull request per step where practical. Never push to `main`.
* New `uses:` lines are pinned to a commit SHA with a version comment.
* Do not widen permissions beyond what this ticket names. Do not add secrets without approval from the security owner.

### How to gather evidence

```bash
export R=Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp

# S7: Security
grep -nE "uses: .*@(main|master|v[0-9]+)\s*(#.*)?$" .github/workflows/*.yml

# S15: Security
gh api "repos/$R/code-scanning/alerts?tool_name=Scorecard&state=open" --jq '.[]|"#\(.number) \(.rule.id) \(.most_recent_instance.location.path):\(.most_recent_instance.location.start_line)"'

# S5: Docker pulls
grep -nE "syft|minver|usebruno|binfmt|curl.*\| *sh" .github/workflows/*.yml
```

### How to fix

1. **S7:** pin every moving `uses:` to a full commit SHA with a version comment, as the rest of the file already does. For `Ed-Fi-Actions` and `slsa-github-generator`, pin to the SHA behind the current `main` and ask the owners for version tags.
2. **S5:** read the versions resolved in the latest green pre-release and API E2E logs, then pin: `dotnet tool install --global minver-cli --version <x.y.z>` (both workflows), `npm install -g @usebruno/cli@<x.y.z>`, Syft through `anchore/sbom-action` at a SHA or the install script with an explicit version and checksum, `tonistiigi/binfmt` by digest.
3. **S15:** pin `postgres:16-alpine` by digest in `compose/DB-Ods/Dockerfile`.
4. Depends on T1 step 2 (Dependabot `github-actions` and `docker` ecosystems) so the new pins are refreshed by PR afterwards.
5. Verify with a pre-release dry run or the next real pre-release that the version number and the SBOM are unchanged.

### Acceptance criteria

* `grep -nE "uses: .*@(main|master|v[0-9]+)" .github/workflows/*.yml` returns nothing.
* No workflow installs Syft, MinVer or the Bruno CLI without an explicit version; `binfmt` and `postgres:16-alpine` are referenced by digest.
* The next pre-release produces the same version number format and an SBOM, and the E2E stack starts with the pinned Postgres image.
* Scorecard's next weekly run closes the 8 `PinnedDependenciesID` alerts (record the alert numbers before and after).

---

## T5 (DEVOPS-195). Ed-Fi-AdminApp: Workflow hygiene: job timeouts, artifact retention, trigger filter, secret scan and SECURITY.md (S6, S27, S14)

**Issue type:** Task | **Parent:** DEVOPS-154 | **Priority (Jira):** Medium | **Labels:** none | **Review:** approved 2026-11-11

### Context

Part of the Ed-Fi-AdminApp CI/CD review (DEVOPS-156, epic DEVOPS-154). Repo: `Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp`, default branch `main`. Items S6, S27, S14 from the review; verdicts and priorities from Session 1 with the developers (2026-11-09 and 2026-11-10).

* Only the UI E2E job sets `timeout-minutes`; the other 22 jobs inherit GitHub's 360-minute default, so a hung step costs six hours of runner time (5 of 42 pre-releases hung 6 h). The Event File artifact uses the default 90-day retention. `copilot-setup-steps.yml` filters by `paths`, but GitHub ignores `paths` on tag pushes and `on-merge-or-tag` pushes a tag on every merge, so it ran 49 times a month for nothing.
* Whether secret scanning and push protection are enabled is not readable through the API with read access (`security_and_analysis` is null). The workflows contain no scan of their own.
* `SECURITY.md` was copied from a .NET repository: it talks about running CodeQL only when C# files change and about .NET fuzzers. Here CodeQL runs for TypeScript on every PR and push.
* Session 1: all three Should. The Actions policy answer from T9 (S26) is recorded in `SECURITY.md` when it arrives.

### Rules for whoever works this ticket (human or LLM)

* Evidence commands are read-only. Run them first and record the numbers here before changing anything.
* One pull request per step where practical. Never push to `main`.
* New `uses:` lines are pinned to a commit SHA with a version comment.
* Do not widen permissions beyond what this ticket names. Do not add secrets without approval from the security owner.

### How to gather evidence

```bash
export R=Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp

# S6: Hygiene
grep -c "timeout-minutes" .github/workflows/*.yml
grep -n "retention-days" .github/workflows/*.yml || echo "no retention-days"
grep -n -A8 "^on:" .github/workflows/copilot-setup-steps.yml
gh run list -R $R --workflow "Copilot Setup Steps" --limit 60 --json event,headBranch -q '[.[]|select(.event=="push")]|length'

# S27: Security
gh api repos/$R --jq '.security_and_analysis // "not readable with this token"'
grep -rn "gitleaks\|trufflehog" .github/workflows/ || echo "no secret scan job"

# S14: Security
grep -n -i "C#\|\.NET\|fuzz\|CodeQL\|csproj" SECURITY.md
gh api repos/$R --jq '.security_and_analysis // "not readable"'
```

### How to fix

1. **S6:** add `timeout-minutes` to every job (15 for lint and build, 30 for E2E, 60 for the publish); add `retention-days: 7` to the Event File upload in `on-pullrequest.yml`; add a `branches:` filter to `copilot-setup-steps.yml` so tag pushes stop triggering it; keep `concurrency` PR-only (release concurrency is S28, T6).
2. **S27:** add a `gitleaks` (or `trufflehog`) job on pull requests scanning the diff, SHA-pinned, non-blocking for the first week, then blocking.
3. **S14:** rewrite `SECURITY.md` for this repo: TypeScript CodeQL on PR and `main`, Dependabot, Scorecard, how to report privately, the Actions policy (from T9) and the vulnerability response time once M12 decides it.

### Acceptance criteria

* Every job in every workflow has `timeout-minutes`; the Event File upload has `retention-days`.
* The Copilot setup workflow no longer runs on tag pushes (zero `push` runs on `refs/tags` after the change).
* The secret-scan job runs on every PR in seconds and catches a test credential pushed to a scratch branch.
* `SECURITY.md` no longer mentions C#, .NET or fuzzing and describes the checks that actually run here; reviewed by the team.

---

## T6 (DEVOPS-196). Ed-Fi-AdminApp: Pre-release workflow: bounded, parallel image builds on ubuntu-latest (S3, S8, S28)

**Issue type:** Task | **Parent:** DEVOPS-154 | **Priority (Jira):** Medium | **Labels:** none | **Review:** approved 2026-11-11

### Context

Part of the Ed-Fi-AdminApp CI/CD review (DEVOPS-156, epic DEVOPS-154). Repo: `Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp`, default branch `main`. Items S3, S8, S28 from the review; verdicts and priorities from Session 1 with the developers (2026-11-09 and 2026-11-10).

* `docker-publish` in `on-prerelease.yml` builds the API image and then the frontend image, one after the other (838 s + 854 s), each for `linux/amd64` and `linux/arm64`; the arm64 half runs under QEMU and occasionally hangs. No job has `timeout-minutes`, so a hang only ends at the 6-hour limit (5 of 42 pre-releases).
* The `pack` job pins `ubuntu-22.04` while every other job uses `ubuntu-latest`, with no comment saying why. `validate` is the only `setup-node` without `cache: npm`. The version comes from MinVer, a .NET global tool, so a Node repository installs .NET tooling only to read git tags.
* Only the PR and E2E workflows set `concurrency`; two merges a few minutes apart start two full 30-minute QEMU publishes at once.
* Session 1: S3 Could (the hang has not been felt, but valid), S8 Could with the decision "keep latest on all, check compatibility with the npm build", S28 Discuss and Later. Native arm64 runners (M7) and the MinVer replacement (L2) are out of scope here.

### Rules for whoever works this ticket (human or LLM)

* Evidence commands are read-only. Run them first and record the numbers here before changing anything.
* One pull request per step where practical. Never push to `main`.
* New `uses:` lines are pinned to a commit SHA with a version comment.
* Do not widen permissions beyond what this ticket names. Do not add secrets without approval from the security owner.

### How to gather evidence

```bash
export R=Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp

# S3: Reliability
grep -n "timeout-minutes\|platforms:\|matrix:" .github/workflows/on-prerelease.yml
gh run list -R $R --workflow "On Pre-Release" --limit 50 --json conclusion,createdAt,updatedAt -q '.[]|"\(.conclusion) \(((.updatedAt|fromdate)-(.createdAt|fromdate))/60|floor) min"' | sort | uniq -c | sort -rn | head

# S8: Runners
grep -n "runs-on" .github/workflows/on-prerelease.yml | sort | uniq -c
grep -n -B2 -A4 "minver" .github/workflows/on-prerelease.yml | head -20
git log -S"ubuntu-22.04" --oneline -- .github/workflows/on-prerelease.yml | tail -3

# S28: Release
grep -ln "^concurrency:" .github/workflows/*.yml
grep -n -A3 "^concurrency:" .github/workflows/*.yml
```

### How to fix

1. **S3:** set `timeout-minutes` on every job of `on-prerelease.yml` (60 for the publish); turn the two sequential builds into a matrix (`api`, `fe`) with `fail-fast: false` so they run on two runners.
2. **S8:** replace `ubuntu-22.04` on `pack` with `ubuntu-latest`; add `cache: npm` to the `validate` job; confirm `pack` and `validate` build on the current image. Leave MinVer in place (L2 decides the versioning tool).
3. **S28:** only after Session 2 agrees: `concurrency: { group: prerelease, cancel-in-progress: false }` on `on-prerelease.yml` and `on-merge-or-tag.yml`. Never cancel a publish in progress.
4. Test on a `patch-v*` branch or a dry run before the first real pre-release; keep the sequential build in git history for an easy revert.

### Acceptance criteria

* A pre-release run shows two parallel publish jobs and finishes in less than the sum of the two previous build times; a hung job is killed at the limit.
* All pre-release jobs run on `ubuntu-latest`; `validate` restores the npm cache; the published images and version number are unchanged.
* If S28 is approved: two merges within minutes queue one publish behind the other, and no publish is cancelled.
* Duration of the last 10 pre-releases recorded before and after.

---

## T7 (DEVOPS-197). Ed-Fi-AdminApp: Actions cache under control: Playwright browsers, npm cache policy, PR cache cleanup, Nx cache trial (S29, S22, S31, S30)

**Issue type:** Task | **Parent:** DEVOPS-154 | **Priority (Jira):** Medium | **Labels:** none | **Review:** approved 2026-11-11

### Context

Part of the Ed-Fi-AdminApp CI/CD review (DEVOPS-156, epic DEVOPS-154). Repo: `Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp`, default branch `main`. Items S29, S22, S31, S30 from the review; verdicts and priorities from Session 1 with the developers (2026-11-09 and 2026-11-10).

* Every PR branch saves its own npm cache entry. The repository limit is 10 GB; at review time 8.3 GB were in use, 5.9 GB from PR refs (10.7 GB two days later), so GitHub evicts the oldest entries, often `main`'s, and an evicted cache costs about 30 s per job across nine jobs.
* Each E2E job runs `npx playwright install --with-deps chromium` on a fresh runner, downloading Chromium every time (median 20 to 21 s per job, two jobs per run); the browser only changes when the `playwright` package changes.
* Every job starts with a cold Nx cache. A local `.nx/cache` in `actions/cache` is a cheaper first step than the remote cache trial (M2).
* Session 1: S29 Should; S22 Could with "validate with Stephen as this is related to the GitHub cache"; S31 Could; S30 Discuss. Steps 2 and 3 are blocked until Stephen answers.

### Rules for whoever works this ticket (human or LLM)

* Evidence commands are read-only. Run them first and record the numbers here before changing anything.
* One pull request per step where practical. Never push to `main`.
* New `uses:` lines are pinned to a commit SHA with a version comment.
* Do not widen permissions beyond what this ticket names. Do not add secrets without approval from the security owner.

### How to gather evidence

```bash
export R=Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp

# S29: Cache
grep -n "playwright install\|ms-playwright\|actions/cache" .github/workflows/run-e2e-ui.yml
id=$(gh run list -R $R --workflow "UI Playwright E2E" --status success --limit 1 --json databaseId -q '.[0].databaseId'); gh run view $id -R $R --json jobs -q '.jobs[]|.name as $j|.steps[]|select(.name|test("Playwright|Install dependencies"))|"\($j) | \(.name) | \(.startedAt) -> \(.completedAt)"'

# S22: Cache
gh api repos/$R/actions/cache/usage --jq '{active_caches_count, gb: (.active_caches_size_in_bytes/1e9)}'
gh api "repos/$R/actions/caches?per_page=100" --jq '[.actions_caches[]|select(.ref|startswith("refs/pull"))|.size_in_bytes]|"PR refs: \(length) entries, \(add/1e9|.*100|round/100) GB"'

# S31: Cache
gh api "repos/$R/actions/caches?per_page=100" --jq '[.actions_caches[]|select(.ref|startswith("refs/pull"))|.ref]|unique|"PR refs with caches: \(length)"'
ls .github/workflows | grep -i cache || echo "no cache cleanup workflow"

# S30: Cache
grep -rn "\.nx/cache\|nx-cache\|nx reset" .github/workflows/ packages/*/Dockerfile || echo "no Nx cache in CI"
grep -n "cacheDirectory\|nxCloudId\|remote" nx.json || echo "no remote cache configured"
```

### How to fix

1. **S29:** cache `~/.cache/ms-playwright` with `actions/cache` keyed on the Playwright version read from `package-lock.json`; keep `--with-deps` (or `playwright install-deps`) for the OS packages. Trial on one job, compare the step time, then apply to both.
2. **S22 + S31 (after Stephen):** use `actions/cache/restore` on pull requests (falling back to `main`'s key) and `actions/cache/save` only on `main`, or key the cache on the lock-file hash alone so PRs reuse `main`'s entry; add a `pull_request: closed` workflow that runs `gh cache delete` for the PR's refs (`actions: write` on that job only).
3. **S30 (trial, after T2 step 1):** `.nx/cache` in `actions/cache`, keyed on the lock file and source hash, restore-only on PRs; compare build step times and keep it only with a measured gain.
4. Record cache usage (`gh api repos/$R/actions/cache/usage`) before and one week after each step.

### Acceptance criteria

* "Install Playwright browser dependencies" drops to a few seconds on a cache hit, and the E2E job still passes on a cache miss.
* After the policy change, total cache usage stays under 10 GB for two consecutive weeks and `main`'s npm cache entry is not evicted.
* Closing a PR deletes its cache entries (visible in `gh api repos/$R/actions/caches`).
* The Nx cache trial has a before/after measurement recorded in this ticket and a keep-or-drop decision.

---

## T8 (DEVOPS-198). Ed-Fi-AdminApp: Clean up unused workflows and dead configuration (S19, S33)

**Issue type:** Task | **Parent:** DEVOPS-154 | **Priority (Jira):** Medium | **Labels:** none | **Review:** approved 2026-11-11

### Context

Part of the Ed-Fi-AdminApp CI/CD review (DEVOPS-156, epic DEVOPS-154). Repo: `Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp`, default branch `main`. Items S19, S33 from the review; verdicts and priorities from Session 1 with the developers (2026-11-09 and 2026-11-10).

* `run-e2e-api.yml` is registered but has never run, and `eng/testing/README.md` points to a file named `api-bruno-e2e.yml`.
* `on-merge-group-cla.yml` ran four times on one day in August 2026; the merge queue is not enabled.
* `release.config.mjs` and the `semantic-release` dependency exist, but no workflow calls them; versions come from MinVer.
* `docs/repository-architecture.md` lists `cloudformation/`, `e2e/` and `scripts/` folders that do not exist.
* The Docker Analysis job builds `hadolint/hadolint-action` from source on every run (5 s per job, two jobs per run) instead of using the prebuilt image.
* Session 1: S19 Should; S33 Discuss and Later. Dead workflows mislead newcomers and still need pinning and review.

### Rules for whoever works this ticket (human or LLM)

* Evidence commands are read-only. Run them first and record the numbers here before changing anything.
* One pull request per step where practical. Never push to `main`.
* New `uses:` lines are pinned to a commit SHA with a version comment.
* Do not widen permissions beyond what this ticket names. Do not add secrets without approval from the security owner.

### How to gather evidence

```bash
export R=Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp

# S19: Hygiene
gh api repos/$R/actions/workflows/run-e2e-api.yml/runs --jq '"API E2E runs ever: \(.total_count)"'
gh run list -R $R --workflow on-merge-group-cla.yml --limit 10 --json createdAt -q '.[].createdAt[:10]' | sort | uniq -c
git grep -n "semantic-release" -- .github || echo "semantic-release not used by any workflow"
grep -n "api-bruno-e2e" eng/testing/README.md; ls -d cloudformation e2e scripts 2>&1 | head -3

# S33: Hygiene
grep -n -B2 -A4 "hadolint" .github/workflows/on-pullrequest.yml
id=$(gh run list -R $R --workflow "On Pull Request" --status success --limit 1 --json databaseId -q '.[0].databaseId'); gh run view $id -R $R --json jobs -q '.jobs[]|select(.name|startswith("Docker Analysis"))|.steps[]|select(.name|test("hadolint"))|"\(.name) \(.startedAt) -> \(.completedAt)"'
grep -n -A3 "uses: actions/setup-node" .github/workflows/on-prerelease.yml   # the second block (validate job) has no cache: line
```

### How to fix

1. **S19:** get the team's decision on each item, then: wire `run-e2e-api.yml` into the UI stack (M19) or delete it, and fix the name in `eng/testing/README.md`; delete `on-merge-group-cla.yml` unless a merge queue (M14) is planned; remove `release.config.mjs` and `semantic-release` from `package.json` unless it is chosen as the versioning tool (L2); fix `docs/repository-architecture.md`.
2. **S33 (after Session 2):** run hadolint as `docker://hadolint/hadolint@sha256:...` instead of building the action. (The `cache: npm` on `validate` part is done in T6.)
3. One PR per decision so each deletion can be reverted alone.

### Acceptance criteria

* The Actions tab lists only workflows that run; `run-e2e-api.yml` is either deleted or has at least one successful run.
* `npm ls semantic-release` reports it is not installed (or L2 records it as the chosen tool).
* `docs/repository-architecture.md` and `eng/testing/README.md` match the repository contents.
* If S33 is approved: the Docker Analysis job log no longer shows "Build hadolint/hadolint-action".

---

## T9 (DEVOPS-199). Ed-Fi-AdminApp: Tighten the main ruleset and confirm the repository Actions policy (admin) (S25, S26)

**Issue type:** Task | **Parent:** DEVOPS-154 | **Priority (Jira):** Medium | **Labels:** none | **Review:** approved 2026-11-11

### Context

Part of the Ed-Fi-AdminApp CI/CD review (DEVOPS-156, epic DEVOPS-154). Repo: `Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp`, default branch `main`. Items S25, S26 from the review; verdicts and priorities from Session 1 with the developers (2026-11-09 and 2026-11-10).

* The `main` ruleset requires one approval and code-owner review but has `dismiss_stale_reviews_on_push: false` and `required_review_thread_resolution: false`. A commit pushed after approval merges on the old approval, and a PR with open review threads can merge. There is no `code_scanning` rule, so open high alerts never block.
* The repository Actions policy (which actions may run, the default `GITHUB_TOKEN` permissions, whether Actions may create and approve pull requests) is only readable by admins; the endpoints return HTTP 403 for read access. Workflows declare `permissions: read-all`, which is safe, but the repo-level defaults are unknown.
* Session 1: S25 Should; S26 Discuss and Later, validate with Stephen and Robert. Settings only, no workflow edits, done by an admin.

### Rules for whoever works this ticket (human or LLM)

* Evidence commands are read-only. Run them first and record the numbers here before changing anything.
* One pull request per step where practical. Never push to `main`.
* New `uses:` lines are pinned to a commit SHA with a version comment.
* Do not widen permissions beyond what this ticket names. Do not add secrets without approval from the security owner.

### How to gather evidence

```bash
export R=Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp

# S25: Governance
for id in $(gh api repos/$R/rulesets --jq '.[].id'); do gh api repos/$R/rulesets/$id --jq '.name + " " + .enforcement + " " + ([.rules[]|.type]|tostring)'; done
gh api repos/$R/rulesets --jq '.[]|select(.name=="main")|.id' | xargs -I{} gh api repos/$R/rulesets/{} --jq '.rules[]|select(.type=="pull_request")|.parameters|{dismiss_stale_reviews_on_push,required_review_thread_resolution,required_approving_review_count}'

# S26: Governance
gh api repos/$R/actions/permissions 2>&1 | head -c 200; echo
gh api repos/$R/actions/permissions/workflow 2>&1 | head -c 200; echo
gh api repos/$R/actions/permissions/selected-actions 2>&1 | head -c 200; echo
```

### How to fix

1. **S25:** an admin edits the `main` ruleset: dismiss stale reviews on push, require conversation resolution, add the `code_scanning` rule (block on open high alerts from CodeQL); decide whether signed commits are wanted and record the decision here.
2. **S26:** Stephen and Robert confirm: default workflow permissions read-only, "Allow GitHub Actions to create and approve pull requests" off, allowed actions limited to GitHub-owned, verified creators and the `Ed-Fi-Alliance-OSS` organization. Record the answer in this ticket and in `SECURITY.md` (T5).
3. Export the ruleset JSON before and after and attach both to this ticket.

### Acceptance criteria

* The `main` ruleset JSON shows `dismiss_stale_reviews_on_push: true`, `required_review_thread_resolution: true` and a `code_scanning` rule.
* The Actions policy answer (three settings) is recorded in this ticket and in `SECURITY.md`.
* A decision on signed commits is recorded, whichever way it goes.

---

## Not ticketed in this round

| Item | Reason | Revisit |
| --- | --- | --- |
| S4 | N/A in Session 1: developers need the `pre` tag for the sibling images in the E2E stack. | Only if a sibling pre-release breaks this repo's E2E again. |
| S10 | Later, by developer request (close the open Dependabot alerts; regenerate `packages/api/package.json`). | After T1 lands. |
| S12 | N/A for now: an `npm audit` step could block PRs. | After S10 and the severity policy from T1 step 4. |

## Publishing checklist

1. Reviewer edits this file (summary, priority, wording, grouping) and clears each "Review" line.
2. Create the tickets in DEVOPS with parent DEVOPS-154, issue type Task, one per section, description as written.
3. Copy each Jira key into the tracking table of `implementation-plan.md` and link the tickets to DEVOPS-156.
4. Run the evidence block of each ticket once and paste the numbers as the first comment (baseline).
