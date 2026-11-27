# DEVOPS-156: short-term items after Session 1

**Ticket:** DEVOPS-156 | **Epic:** DEVOPS-154 | **Repo:** `Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp` | **Date:** 2026-11-10

This file is the list of short-term items (S1 to S33) from the CI/CD review, with the verdict, priority and notes recorded after Session 1 with the developers (2026-11-09 and 2026-11-10). It is the source for the ticket groups in `implementation-plan.md`.

Sources:

- Review documents in the workspace docs folder (`docs/Ed-Fi-AdminApp/` next to the repos, not committed): `ci-workflow-review.md` section 6.1 (the item table), `ci-executive-brief.md` section 3 (the narrative), `dockerfile-review.md` and `workflow-structure-review.md` (DF and W items referenced below).
- The shared review board (Claude artifact "Admin App CI Review Board"), where the verdicts, priorities and comments were entered.

Legend. Effort: **S** = hours to one day, **M** = a few days, **(admin)** = repository settings, no code, **(trial)** = measure before adopting. Verdict: **Agree** (do it), **N/A** (not applicable here), **Discuss** (needs a conversation first). Priority: **Must**, **Should**, **Could**, **Later**.

## 1. Tally

| Verdict | Count |
| --- | --- |
| Agree | 27 |
| Discuss | 4 |
| N/A | 2 |

| Priority | Count | Items |
| --- | --- | --- |
| Must | 3 | S13 (Agree), S17 (Agree), S21 (Agree) |
| Should | 17 | S1 (Agree), S2 (Agree), S5 (Agree), S6 (Agree), S7 (Agree), S9 (Agree), S11 (Agree), S14 (Agree), S15 (Agree), S16 (Agree), S19 (Agree), S23 (Agree), S24 (Agree), S25 (Agree), S27 (Agree), S29 (Agree), S32 (Agree) |
| Could | 7 | S3 (Agree), S8 (Agree), S18 (Agree), S20 (Agree), S22 (Agree), S30 (Discuss), S31 (Agree) |
| Later | 5 | S10 (Agree), S12 (N/A), S26 (Discuss), S28 (Discuss), S33 (Discuss) |
| (none) | 1 | S4 (N/A) |

## 2. Items

| ID | Area | Item | Why / evidence | Effort | Verdict | Priority | Session 1 notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | Reliability | **Make Dependabot produce installable PRs:** add `legacy-peer-deps=true` to `.npmrc` (Dependabot reads it, CI already uses the flag); remove or keep in sync the three `overrides` that are also direct dependencies (`axios`, `@nestjs/swagger`, `@eslint/eslintrc`); add a Dependabot `nx` group (`nx`, `@nx/*`) so the plugin set moves together | 22 of 69 updater jobs fail; lock-file out-of-sync and `@nx/vite:build` failures on bot PRs; 72 of 200 bot PRs closed unmerged | S | Agree | Should |  |
| S2 | Reliability | Give Dependabot PRs Docker Hub access (Dependabot secrets: `DOCKER_HUB_TOKEN`) or skip the login and the image build for `dependabot[bot]` | Dependabot secrets list is empty; `Password required` in 12 runs, then anonymous pulls of about 10 images per E2E job | S | Agree | Should | Docker login is not implemented. Push/pull rate limit. Admin API doesnt allow to use docker login. It would be nice to have to review Admin API for docker login. |
| S3 | Reliability | **Release chain:** `timeout-minutes` on `docker-publish` and the whole pre-release; split api and fe into a matrix so they build in parallel | 5 of 42 pre-releases hung 6 h; api and fe build sequentially (838 s + 854 s) | S | Agree | Could | No se ha experimentado la molestia pero es valido implementarlo. |
| S4 | Docker pulls | Pin the sibling images the E2E stack pulls (`ADMIN_API_TAG_7X=pre`, `ADMIN_DB_TAG_7X=pre`, `ADMIN_TAG_6X=pre`) to digests for CI, or make the moving tag an explicit choice; keep the 3-attempt pull retry from PR #425 | A sibling repo's bad pre-release breaks this repo's E2E; non-reproducible runs | S | N/A |  | No applicable, Devs needed to use pre tag |
| S5 | Docker pulls | Pin tools downloaded at run time: `syft` via `curl ... \| sh` from `main`, `minver-cli` (dotnet tool, unversioned), `@usebruno/cli` (`npm install -g`, unversioned), `tonistiigi/binfmt:latest` | Scorecard `downloadThenRun`; a tool release can change a signed release build | S | Agree | Should | Check donet tool cli in regarding how to pin versions. |
| S6 | Hygiene | `timeout-minutes` on the 22 jobs without one; `retention-days` on the Event File upload; `branches:` filter on `copilot-setup-steps` (path filters are ignored on tag pushes, 49 runs/month); keep `concurrency` PR-only and never on releases | Cheap safety net; 6-hour hangs | S | Agree | Should |  |
| S7 | Security | Pin to SHA: `repository-scanner.yml@main` (the **required** check), `secure-download-artifact@main`, `setup-node@v4`, `upload-artifact@v4`, `download-artifact@v4` in `on-prerelease.yml` | 6 Scorecard pinning alerts; moving refs in the release chain and in a required check | S | Agree | Should | This is a standard and must be applied. |
| S8 | Runners | Document or remove the `ubuntu-22.04` pin on `pack`; stop installing the .NET MinVer tool in a Node repo (compute the version in Node, or with `git describe`); add `cache: npm` to the validate job | Runner image updates can change the SDK under a green build; one less toolchain | S | Agree | Could | keep latest on all, check compatibility with npm build |
| S9 | Runners | `open-pull-requests-limit`, `cooldown` and the `nx` group in `dependabot.yml`; consider a `major` schedule | 4 `@nx/*` major PRs open at once, each starting about 12 jobs | S | Agree | Should |  |
| S10 | Security | Close the open Dependabot alerts: regenerate `packages/api/package.json` dependencies from the root (NestJS `^10` declared, 12 used; alert #126 open since 2026-04-06); fix the `undici` override conflict (4 alerts) | 6 open alerts, one 7 months old | S | Agree | Later | Check later. For later iterrations. |
| S11 | Security | Add Dependabot `docker` and `github-actions` ecosystems (weekly, grouped) | Digest and SHA pins are refreshed by hand (PR #361); `node:24-alpine` and `nginx:alpine` digests will go stale | S | Agree | Should | Keep docker scout to validate docker actions. |
| S12 | Security | Run an npm audit in CI: `npm audit --omit=dev --audit-level=high` or OSV-Scanner on `package-lock.json`, with the existing `osv-scanner.toml` ignore list and its expiry dates | No dependency audit runs in CI; Sandworm script exists but is unused | S | N/A | Later | Check for later as this could be a blocker on PRs |
| S13 | Security | Configure `dependency-review-action`: `fail-on-severity` (decide the level; default is `low`), `comment-summary-in-pr`, license rules; keep it blocking | 8 bot PR failures; the `zod` high finding was legitimate, but the policy is implicit | S | Agree | Must |  |
| S14 | Security | Rewrite `SECURITY.md` for this repo (CodeQL runs on every PR and push for TypeScript; no .NET); confirm push protection | Document describes another repo | S | Agree | Should |  |
| S15 | Security | Pin what Scorecard flags: `postgres:16-alpine` by digest in `compose/DB-Ods/Dockerfile`, the `syft` download, the six GitHub-owned actions by hash | 8 medium Scorecard alerts | S | Agree | Should |  |
| S16 | Innovation | `$GITHUB_STEP_SUMMARY` on PR and E2E runs: unit-test counts per package, E2E pass/fail/flaky, image sizes, audit summary | Visibility without opening logs | S | Agree | Should |  |
| S17 | Innovation | Advisory AI failure digest: on a failed run, post a short summary of `gh run view --log-failed` as a PR comment | Bot PR and E2E failures are repetitive to read | S-M | Agree | Must |  |
| S18 | Innovation | CI health report: schedule the `gh` queries from this review (duration, failure rate by actor, queue, cache usage) into a summary | Baseline to prove future gains | S | Agree | Could |  |
| S19 | Hygiene | **Clean up unused workflows and dead config:** `run-e2e-api.yml` (registered, 0 runs ever; docs point to a file named `api-bruno-e2e.yml`), `on-merge-group-cla.yml` (4 runs in Aug 2026, merge queue not enabled; keep only if M14 goes ahead), `release.config.mjs` + `semantic-release` (unused), `docs/repository-architecture.md` (lists `cloudformation/`, `e2e/`, `scripts/` that do not exist) | Ghost entries and dead config mislead newcomers and still need upkeep | S | Agree | Should |  |
| S20 | Quality gate | **Make the lint gates real:** run `prettier:check` only (today `prettier:write` runs first, so the check cannot fail); add ESLint (`npm run lint:check` or `nx run-many -t lint`) to CI; add `common-ui` to the test matrix (3 spec files never run in CI) | Husky pre-commit is bypassable; CI has no ESLint; a formatting gate that always passes | S | Agree | Could |  |
| S21 | Speed | Remove the `setup -> lint -> build_and_test` chain: let every job depend only on checkout (`setup` installs for nobody; the npm cache is warmed by whichever job runs first) | Critical path 52 + 70 + 131 s against 138 s for the longest single job: about 2 min off the 4.4 min median | S | Agree | Must |  |
| S22 | Cache | Stop writing npm caches from PR refs (restore-only on PRs with `actions/cache/restore`, save on `main`), or key the cache so bot PRs reuse `main`'s entry | 8.3 of 10 GB used, 5.9 GB from PR refs; eviction of `main` entries costs every job 30 s | S | Agree | Could | Validate with Stephen as this is related to Github Cache. |
| S23 | Quality gate | **Type-check the front end:** add a `typecheck` target (`tsc --noEmit -p packages/fe/tsconfig.app.json`) and run it in the PR matrix | `@nx/vite:build` transpiles without type-checking; only api, utils and models go through `tsc`; no `typecheck` target in any `project.json` | S | Agree | Should |  |
| S24 | Quality gate | Lint the workflow files: `actionlint` (syntax, expressions) and `zizmor` (workflow security) on PRs that touch `.github/`, and in `lint-staged` | Neither tool is present; they flag unpinned `@main` references, over-broad permissions and template-injection risks automatically | S | Agree | Should |  |
| S25 | Governance | Tighten the `main` ruleset: dismiss stale reviews on push, require conversation resolution, add the `code_scanning` rule (block merge with open high alerts); decide on signed commits | Ruleset JSON: `dismiss_stale_reviews_on_push: false`, `required_review_thread_resolution: false`, no signed-commit rule | S (admin) | Agree | Should |  |
| S26 | Governance | Ask an admin to confirm the repository Actions policy: default `GITHUB_TOKEN` read-only, "Allow GitHub Actions to create and approve pull requests" off, allowed actions limited to GitHub, verified creators and the Ed-Fi org | The three policy endpoints return HTTP 403 to read access; unverified (see question 13) | S (admin) | Discuss | Later | Validate with Stephen and Robert. |
| S27 | Security | Independent secret scan on PRs (`gitleaks` action, or the `trufflehog` action) | `security_and_analysis` is not readable, so push protection is unconfirmed; the scan costs seconds and does not depend on an org setting | S | Agree | Should |  |
| S28 | Release | `concurrency` on `on-prerelease.yml` (group per workflow, no cancel) and on `on-merge-or-tag.yml` | Only the PR and E2E workflows set `concurrency`; two quick merges stack two 30-minute QEMU publishes | S | Discuss | Later |  |
| S29 | Cache | Cache the Playwright browsers (`~/.cache/ms-playwright`, key on the Playwright version from `package-lock.json`); keep `--with-deps` for the OS packages | "Install Playwright browser dependencies" median 20 to 21 s per E2E job (40 jobs per database), 2 jobs per run | S (trial) | Agree | Should |  |
| S30 | Cache | Nx local cache (`.nx/cache`) in `actions/cache`, keyed on the lock file and source hash, restore-only on PRs | Every job starts cold; a cheaper first step than the remote cache trial (M2) | S (trial) | Discuss | Could |  |
| S31 | Cache | Delete a PR's caches when it closes (`pull_request: closed` workflow calling `gh cache delete`) | Complements S22; 5.9 GB of the 8.3 GB are PR refs | S | Agree | Could |  |
| S32 | Reports | Playwright `github` reporter (failures annotated on the PR diff) and a Scorecard badge in the README | Allure and JUnit are uploaded but failures are not annotated; the Scorecard result is only visible in the Security tab | S | Agree | Should |  |
| S33 | Hygiene | Run hadolint from the prebuilt image (`docker://hadolint/hadolint@sha256:...`) instead of building the action; add `cache: npm` to the pre-release `validate` job | "Build hadolint/hadolint-action" 5 s per Docker Analysis job, 2 jobs per run; `validate` is the only `setup-node` without a cache | S | Discuss | Later |  |

## 3. Decisions and follow-ups taken from the notes

| Item | Note from Session 1 | What it means for the work |
| --- | --- | --- |
| S2 | Docker login is not implemented; push/pull rate limit. Admin API does not allow docker login; review Admin API for docker login. | Keep S2 for this repo (Dependabot secrets or a guard on the login step). Open a note for `ODS-Admin-API`: its workflows have no Docker Hub login, so its E2E jobs pull anonymously and hit the rate limit. Cross-repo item, not part of this ticket. |
| S3 | The hang has not been felt, but it is valid to implement. | Keep, priority Could. Do the `timeout-minutes` part first (cheap); the api/fe matrix is the second step. |
| S4 | Not applicable, developers need to use the `pre` tag. | Out of scope. The E2E stack keeps pulling sibling images by the `pre` tag. Keep the 3-attempt pull retry from PR #425 as is. |
| S5 | Check how the dotnet tool CLI pins versions. | Before the PR: confirm `dotnet tool install --global minver-cli --version <x.y.z>` and the version to pin (read the version resolved in a recent green pre-release log). Same for `@usebruno/cli` and Syft. |
| S8 | Keep latest on all; check compatibility with the npm build. | Decision: use `ubuntu-latest` on every job (remove the `ubuntu-22.04` pin on `pack`). Verify the pre-release `pack` and `validate` jobs still build on the current `ubuntu-latest` image. The MinVer-in-Node part stays open (see L2). |
| S10 | Check later, for later iterations. | Deferred. Not in the first round of tickets. |
| S11 | Keep Docker Scout to validate Docker actions. | Adding the Dependabot `docker` and `github-actions` ecosystems does not replace Docker Scout; the Docker Analysis job keeps running Scout on PRs. |
| S12 | Check for later, as this could block PRs. | Deferred. If picked up later, start it non-blocking (`continue-on-error`) and make it block only when the backlog is empty. |
| S13 | (no note; priority Must) | The team still has to decide `fail-on-severity` (`high` proposed) and whether a license rule is wanted. |
| S22 | Validate with Stephen, as this relates to the GitHub cache. | Blocked on a conversation with Stephen before any change to cache save/restore policy. S31 (delete PR caches on close) is the same topic; validate both together. |
| S26 | Validate with Stephen and Robert. | Admin-only. Ask Stephen and Robert to confirm the Actions policy; record the answer in `SECURITY.md` (S14). |
| S28 | (Discuss, Later) | Needs the Session 2 conversation on releases: queue publishes or not. No change until then. |
| S30 | (Discuss, Could) | Trial only after S21 lands and after the cache policy from S22 is agreed. |
| S33 | (Discuss, Later) | Two small parts: hadolint from the prebuilt image, and `cache: npm` on the pre-release `validate` job (the second overlaps S8). Decide in Session 2. |

## 4. Items out of the first round

| ID | Reason | Revisit when |
| --- | --- | --- |
| S4 | N/A: developers need the `pre` tag in the E2E stack. | Only if a sibling pre-release breaks this repo's E2E again. |
| S10 | Later, by developer request. | After the Dependabot ticket lands (the stale `packages/api/package.json` manifest is also DF8). |
| S12 | N/A for now: an audit step could block PRs. | After the open Dependabot alerts are closed (S10) and a severity policy exists (S13). |
| S26, S28, S30, S33 | Discuss. | Session 2. |

## 5. Cross-repo note

From the S2 comment: `ODS-Admin-API` does not log in to Docker Hub in its workflows, so its E2E jobs pull anonymously and can hit the pull rate limit. That belongs to the ODS-Admin-API review (DEVOPS-155 / DEVOPS-162), not to this ticket. Record it there.
