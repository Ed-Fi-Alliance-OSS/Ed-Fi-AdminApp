---
name: adminapp-env
description: Configure, run, validate, and troubleshoot the Ed-Fi Admin App's local Docker environment (fe, api, ODS/API, Ed-Fi Admin API, Keycloak, Postgres/MSSQL, nginx, pgAdmin). Use when the user wants to set up, start, check the health of, fix, or ask how to access this repo's local dev stack.
---

# Ed-Fi Admin App Local Environment

You are operating this repo's local Docker Compose environment: the Admin App (`fe` + `api`),
ODS/API, the Ed-Fi Admin API, Keycloak, Postgres/MSSQL, nginx, and pgAdmin.

**Ground rules, before anything else:**

- **Ground truth is always live.** Never trust a hardcoded claim about container counts, ports,
  or env var names from memory — read `compose/*.yml` and `compose/.env` fresh.
  `reference/environment-reference.md` is a cache of that, not a second source of truth: if
  validation finds it's drifted from the live files, correct it directly (no confirmation needed).
- **Documented-only tags upgrade on exercise.** Every entry in `reference/environment-reference.md`
  and `reference/known-issues.md` carries a Verified-live vs. Documented-only tag. When you
  exercise a path tagged Documented-only and it works, upgrade that entry's tag to Verified-live
  (corrective-maintenance tier, no confirmation needed). If it fails instead, that's a new
  known-issue candidate — follow the "When you learn something new" process below.
- **Never rebuild a container-mode image on your own initiative.** `packages/api`/`packages/fe`
  are baked into `edfiadminapp-api`/`edfiadminapp-fe` at build time — a source edit has no effect
  on running containers until rebuilt. If you notice `packages/api` or `packages/fe` has changes
  newer than the running image's build time, say so as an observation ("your source has changed
  since this image was built") but only rebuild if the user explicitly asks.
- **Never use unscoped Docker cleanup.** See `reference/known-issues.md`'s scope-safety entry
  before running any reset — this machine may also have the unrelated `ODS-Admin-API` repo's own
  Compose resources.
- **Always scope log-based error checks to a recent window or the latest occurrence.** When
  grepping container logs for errors as part of validation (e.g. `Select-String`/`grep` over
  `docker logs`), scope to a recent time window (e.g. `docker logs --since 5m`) or check only the
  latest matching occurrence, not just whether an error appears anywhere in the history. A
  long-lived container's full log can contain old, already-resolved errors (from a prior startup
  race, an expired cert since regenerated, etc.) that look identical to a current problem —
  confirmed twice already (the v3 schema-error check, the OIDC registration check; see
  `reference/environment-reference.md` and `reference/known-issues.md`).
- **Infer expertise/tone from how the user talks; never ask for it directly.** If they ask
  clarifying "what does X mean" questions or seem new to this stack, explain more (pull concise
  explanations from `reference/glossary.md` rather than inventing them inline). If they use precise
  technical language and move fast, skip explanations and act. Check memory for an existing
  `user`-type note about this before the session starts guessing; if the user's current behavior
  clearly contradicts what's stored, update that memory rather than trusting the stale label
  forever — this is a running best-guess, not a permanent verdict. If no such memory exists yet,
  don't just guess and move on: once you've formed a reasonably confident read of this user's
  expertise/tone within the session, save a new `user`-type memory describing it, so future
  sessions have something to start from instead of guessing cold every time.

## Entry-point flow

Unless the user's own request already makes the choice obvious, follow this on invocation:

1. **Read `compose/.env`.**
   - Missing or missing required values (e.g. `SQL_BACKUPS_FOLDER` unset) → walk through
     `reference/environment-reference.md`'s "One-time setup" section, asking the user only for
     whichever specific values are actually missing. Never re-ask for values already present. Once
     collected, write the missing values into `compose/.env` before proceeding — don't just hold
     them in conversation.
   - `SQL_BACKUPS_FOLDER` is a path outside this repo, different on every machine — never assume a
     previously-seen value (e.g. from another user's session or an earlier run) applies here. After
     the user gives their path, verify the two expected `.sql` files actually exist there (a plain
     file-existence check, e.g. via Glob/`ls`) before writing it to `.env` — this is expected to
     trigger a one-time Claude Code permission prompt for that folder on a machine that's never
     granted it before. That prompt is normal, not a sign anything is broken; once granted it's
     remembered locally per user (`.claude/settings.local.json`, gitignored — never shared or
     committed, so this is naturally per-user with no cross-contamination between teammates).
   - Present and populated → proceed to step 2.

2. **Ask, unless the user's phrasing already answered these:**
   - **State**: "Start fresh (full reset: remove containers/images/volumes, then rebuild)" vs.
     "Just check current state / fix what's broken."
   - **Mode**: "Full containers (fe + api as Docker containers)" vs. "Local dev (fe + api via
     `npm run start:*:dev`, hot reload)."
   - If nothing is running yet and the request is genuinely ambiguous, check `docker ps` first —
     only ask if that doesn't resolve the ambiguity.
   - Separately, if the user wants the Admin App's **own** database on SQL Server instead of
     Postgres, that's an orthogonal `DB_ENGINE`/`-MSSQL` choice, not part of State/Mode — see the
     "Starting modes" section of `reference/environment-reference.md` for the mechanics (it does
     not affect the ODS/Admin databases for any topology, which stay Postgres regardless).

3. **Act on the combination:**
   - **Fresh + Container** → run `reference/environment-reference.md`'s full reset recipe, then
     `start-services.ps1 -Rebuild`, then the full validation checklist (step 5 below).
   - **Fresh + Local dev** → run the same reset for supporting services, then
     `start-local-dev.ps1`, then walk the user through `npm run start:api:dev` /
     `npm run start:fe:dev` in separate terminals, then validate.
   - **Validate + either mode** → run the validation checklist (step 5) against whatever's
     currently running.
   - **Registering an environment in the Admin App UI** (whenever the user's request is this,
     regardless of which State/Mode combination is running) → an OAuth client needs to exist
     against the Admin API first. See `reference/environment-reference.md`'s "OAuth client
     registration" recipe before walking the user through the UI step.

4. **If validation finds something broken:**
   - Check `reference/known-issues.md` for a matching symptom first — apply its documented fix if
     one matches.
   - No match found → invoke `superpowers:systematic-debugging` **inline, in this same
     conversation** — do not delegate to a background subagent. This keeps the user able to
     interject on a risky step before it runs (this mattered concretely once: a user stopped an
     unscoped `docker volume ls`-based removal before it could delete an unrelated project's
     volumes).
   - Once a root cause and fix are confirmed → apply the fix, then **ask the user before adding a
     new entry to `reference/known-issues.md`** describing it (this is different from correcting
     an existing entry that's gone stale, which needs no confirmation).

5. **Validation checklist** (from `reference/environment-reference.md`, run in this order):
   - Container health baseline (`docker ps`, expect the documented healthy/non-healthchecked
     split).
   - Endpoint smoke test table.
   - v3 Admin API log sanity check (schema-error grep).
   - First-login database check.
   - OIDC login verification (log check, and the full curl-based login simulation if the user
     wants end-to-end confirmation without opening a browser).

6. **On any successful setup/run/validate, always print an access summary** — see below.

## Always surface access info

After any successful setup/run/validate, print a concise summary sourced from
`reference/environment-reference.md`, reflecting what's actually configured (read `.env`'s DB
engine/profile live — don't assume Postgres):

- **Admin App UI** — the active URL (container-mode or local-dev, whichever is running) and how
  to log in (a Keycloak user's email/password — not a separate credential store).
- **Keycloak** — admin console URL, admin credentials, realm.
- **Database** — Postgres or SQL Server, whichever `.env` actually selects — host/port/user/
  password/database, plus how to reach the per-topology databases that don't publish a host port.

## Explaining concepts

When introducing something non-obvious (Keycloak, OIDC discovery, Compose profiles, why nginx
fronts everything, `AdminApiMode` v1/v2/v3, floating vs. pinned image tags), pull the explanation
from `reference/glossary.md` rather than writing a new one inline. If an explanation there is
wrong or unclear, fix it directly — that's corrective-maintenance tier.

## When you learn something new

A freshly diagnosed root cause (the kind of finding that takes real investigation, not just
reading a compose file) is exactly what makes this skill self-improving. Once you've confirmed a
root cause and fix:

1. Ask the user: "Want me to add this to the known-issues reference?"
2. If yes, add a new section to `reference/known-issues.md` following the existing format
   (Symptom / Root cause / Fix, tagged Verified-live), and mention what you added.
3. Never commit the change yourself — leave it for the user to review via `git diff` and commit
   when they're ready, per this repo's standard git workflow.
