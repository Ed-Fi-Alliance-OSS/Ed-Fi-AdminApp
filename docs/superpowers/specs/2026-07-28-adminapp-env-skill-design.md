# Design: `adminapp-env` Claude Code Skill

**Date**: 2026-07-28
**Status**: Approved for planning

## Problem

Getting the Ed-Fi Admin App's local Docker environment (fe, api, ODS/API, Ed-Fi Admin API,
Keycloak, Postgres/MSSQL, nginx, pgAdmin) configured, running, and validated required a full
session of live investigation to get right — including two real bugs (a `SQL_BACKUPS_FOLDER`
path mismatch, a five-months-stale floating Docker image causing schema errors) and one that
looked like a config problem but was actually an expired self-signed SSL certificate silently
breaking OIDC login. That knowledge currently lives in a single markdown file
(`how to configure.md`) at the repo root, written by hand, that doesn't self-update and gives no
differentiated experience for a newcomer vs. an experienced dev.

This skill turns that one-off investigation into a repeatable, self-improving capability: a single
Claude Code skill that configures, runs, validates, and fixes this environment, explains what it's
doing along the way when useful, and gets smarter over time as it hits new issues.

## Audience & scope decisions

- **Team-shared**: lives in this repo under `.claude/skills/`, checked into git. Every teammate
  with Claude Code gets it on clone; fixes one person finds become everyone's knowledge.
- **Claude-only, not model-agnostic**: no parallel effort to make this usable by Copilot/Cursor.
  The repo already has enough documentation (`compose/readme.md`, `docs/ed-fi-development.md`,
  `AGENTS.md`); a fourth, model-agnostic tree would be pure duplication for a need nobody's
  expressed yet. `AGENTS.md` gets one pointer line added so a non-Claude-Code reader at least
  knows this exists.
- **No bundled scripts — pure instructions.** Every operation (setup, start, validate, reset,
  login simulation) is written as instructions in the skill's markdown, executed fresh each time
  via Bash/PowerShell tool calls, not as pre-written `.ps1`/`.sh` files. This avoids having two
  representations of "how to do X" (a script *and* a description of the script) that can drift
  apart — there is exactly one place that is simultaneously the spec and what gets run, so
  self-correction means editing that one text.

## Architecture

```text
.claude/skills/adminapp-env/
  SKILL.md                          # entry point: routing, ground rules, the four flows
  reference/
    known-issues.md                 # experiential findings — self-improves over time
    environment-reference.md        # cached URLs/credentials/container counts/engine — self-refreshed
    glossary.md                     # plain-language concept explanations, loaded on demand
```

**Ground truth vs. experiential knowledge** — the core split the whole design hangs on:

- **Ground truth** (`compose/*.yml`, `.env`/`.env.example`, `package.json` scripts, Dockerfiles):
  never duplicated as static claims. `SKILL.md` re-derives from these live every run (which
  services exist, what ports they use, what env vars are required). `environment-reference.md` is
  a *cache* of this derivation for speed, not a second source of truth — the validate flow
  re-checks it against the live files and corrects it silently if it's drifted.
- **Experiential knowledge** (`known-issues.md`): things that cannot be derived by reading the
  compose files — the SSL cert's 365-day validity silently breaking login, two floating Docker
  tags (`edfialliance/ods-admin-api:pre` and `ods-admin-api-db:pre`) drifting out of sync, the
  Keycloak first-boot healthcheck race, the stray machine-level `OPENSSL_CONF` env var. This is
  what "self-improving" actually means for this skill — it only grows here.

## Entry-point flow

On invocation (unless the user's own request already makes the choice obvious):

```text
1. Read compose/.env.
   - Missing/incomplete (e.g. SQL_BACKUPS_FOLDER unset) → first-time setup: ask ONLY for the
     missing values, write them to .env. Never re-ask for values already present.
   - Present → proceed.

2. Ask (unless already answered by the user's phrasing):
   a) State: "Start fresh (full reset: remove containers/images/volumes, rebuild)"
             vs "Just check current state / fix what's broken"
   b) Mode:  "Full containers (fe + api as Docker containers)"
             vs "Local dev (fe + api via `npm run start:*:dev`, hot reload)"

3. Act:
   - Fresh + Container  → clean-room rebuild (stop/remove this project's containers, volumes,
                           images only — see scope-safety note below — then start-services.ps1
                           -Rebuild), then run the full validation checklist.
   - Fresh + Local dev   → same reset for supporting services, then start-local-dev.ps1, then
                           guide the user through `npm run start:api:dev` / `start:fe:dev`,
                           then validate.
   - Validate + either   → run the validation checklist against whatever's currently running.
   - Ambiguous, nothing running yet → infer from `docker ps` state; ask only if genuinely unclear.

4. If validation finds something broken:
   a. Check known-issues.md for a matching symptom first (fast path — apply the documented fix).
   b. No match → invoke superpowers:systematic-debugging INLINE (not via a background subagent —
      this keeps the user able to interject on risky steps, e.g. stopping an unscoped destructive
      command before it runs, as happened during the investigation that produced this design).
   c. Once root cause + fix are confirmed → apply the fix, then ask the user before adding a new
      entry to known-issues.md (see write rules below).

5. On success (any path), always print an access summary — see "Always surface access info" below.
```

**Scope-safety note** (carried over from `how to configure.md` §10, must not be lost): this
repo's Docker resources share the machine with the unrelated `ODS-Admin-API` repo's own
standalone Compose setup. The skill must never use unscoped volume/container removal
(`compose/stop.ps1 -V`'s `Remove-Volumes` runs `docker volume ls` with no project filter). Any
reset must explicitly target only `edfiadminapp`-prefixed resources, `nginx`, and
`edfiadminapp/db-ods:local` — never touch anything named `adminapi`, `ed-fi-*-adminapi`,
`vol-db-admin-adminapi`, or `singletenant-*`.

## Knowledge base write rules

Two tiers, deliberately different friction levels:

1. **Corrective maintenance** — a documented command that's gone stale, a path that moved, a
   typo, `environment-reference.md` drifting from the live compose files. The skill fixes this
   directly, no confirmation required. Still visible in `git diff` before the user commits —
   the skill never commits on its own (this repo's existing git-safety rules already require
   explicit user request for any commit).
2. **New known-issue entries** — a freshly diagnosed root cause and fix (the kind of finding that
   took a full debugging session to produce, like the SSL cert or image-drift issues). The skill
   always asks the user before writing this, since it's adding a new experiential claim to
   knowledge the whole team will rely on, not just correcting something already agreed.

Every entry in `known-issues.md` and `environment-reference.md` carries a **verified-live vs.
documented-only** tag. When the skill exercises a documented-only path for the first time and it
works, the tag upgrades to verified-live; if it fails, that failure is itself a new known-issue
candidate rather than a silent gap.

## Memory & adaptation (expertise/tone)

- **Inferred, never asked.** The skill reads how the user talks/asks within a session — do they
  request more explanation, or move fast with precise technical language — and adapts verbosity
  accordingly. No onboarding question, no explicit setting.
- **Persisted per-user, per-machine**, via Claude Code's existing memory system (outside the repo,
  not git-tracked — so this is inherently personal even though the skill itself is team-shared).
  Once the skill has a reasonably confident read within a session, it saves a `user`-type memory
  describing it.
- **Re-evaluated, not fixed forever.** Each session, if current behavior clearly contradicts the
  stored profile (a user inferred as needing more explanation is now firing off precise commands
  with no questions, or vice versa), the skill updates the memory. This mirrors people changing
  over time — the stored profile is a running best-guess, never a permanent verdict.

## Teaching & explaining concepts

When the skill introduces something non-obvious (Keycloak, OIDC discovery, Compose profiles, why
nginx fronts everything, the difference between `AdminApiMode` v1/v2/v3), it pulls a short
explanation from `glossary.md` rather than inventing one inline each time. This keeps explanations
consistent session to session and gives the user one place to correct an explanation that's wrong
or unclear — corrections to `glossary.md` are corrective-maintenance tier (no confirmation needed).

How much the skill explains, and how often, is governed by the inferred expertise/tone from the
memory section above — not a separate toggle.

## Always surface access info

After any successful setup/run/validate, the skill prints a concise access summary sourced from
`environment-reference.md`, reflecting what's actually configured (not a hardcoded default):

- **Admin App UI** — active URL (container-mode or local-dev, whichever is running) + how to log
  in (a Keycloak user's email/password — not a separate credential store).
- **Keycloak** — admin console URL, admin credentials, realm.
- **Database** — Postgres *or* SQL Server, whichever engine `.env`'s `DB_ENGINE`/profile actually
  selects — host/port/user/password/database, plus how to reach the per-topology databases that
  don't publish a host port (pgAdmin, pre-configured servers; or `docker exec ... psql`).

## Content migration (then delete `how to configure.md`)

| From `how to configure.md` | Goes to |
| --- | --- |
| §0 repo distinction, §1 prereqs, §2 one-time setup, §3 starting modes | `SKILL.md` flow instructions |
| §4/§5 verified URLs & access credentials | `environment-reference.md` |
| §6/§7 Keycloak behavior, first-login mechanics | `SKILL.md` (flow) + `glossary.md` (concepts) |
| §8 OAuth client registration | `SKILL.md` (as part of setup, when relevant) |
| §9 verification checklist, §9.5 OIDC login simulation | `SKILL.md` validate step, written as instructions |
| §10 full reset procedure | `SKILL.md` fresh-start step |
| §11 known issues (SSL cert, image drift, Keycloak race, `OPENSSL_CONF`, etc.) | `known-issues.md`, tagged verified-live |
| §12 FAQ | Split: concept questions → `glossary.md`; troubleshooting questions → `known-issues.md` |

`AGENTS.md` gets one line added pointing to the skill so a reader without Claude Code still knows
this capability exists and roughly where.

## Validating the finished skill

No separate test suite — this is instructions, not code. Immediately after building it, dry-run
the skill's "just validate" branch against the current live stack (already up and healthy from
today's session, all 32 containers). This is a real smoke test at zero cost: if the skill's own
instructions don't reproduce the same checks performed manually earlier, that's a bug in the
skill, found immediately rather than on someone's next cold start.

## Out of scope (explicitly deferred, not forgotten)

- **MCP server** exposing these actions to non-Claude agents — revisit if a teammate on
  Copilot/Cursor actually asks for equivalent support.
- **Bundled PowerShell/bash scripts** — deliberately rejected in favor of pure instructions, to
  keep exactly one source of truth per operation.
- **Splitting into multiple skills** (setup/validate/fix) — rejected; all phases share the same
  knowledge base and splitting risks Claude picking the wrong skill for an ambiguous request.

Note: the `mssql` profile and local-dev mode are both fully in-scope *flows* (the skill must
support choosing them) — they are simply tagged documented-only in the migrated content, per the
verified-live/documented-only distinction above, until someone actually exercises them through the
skill and the tag upgrades.
