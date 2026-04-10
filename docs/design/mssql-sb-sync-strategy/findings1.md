# MSSQL SB Sync Strategy — Design Review Findings (Claude Sonnet 4.5)

> **Source document reviewed:** `docs/design/mssql-sb-sync-strategy.md`
> **Codebase verified against:** `packages/api/src/sb-sync/`, `packages/models-server/src/entities/sb-sync-queue.view.entity.ts`

---

## Gap 1 — Race Condition in `processJobs()` (High Severity)

**Problem:** The `processJobs()` implementation fetches jobs with `state IN ('created', 'retry')` and then separately updates each job to `'active'`. These are two non-atomic operations. In a single-instance deployment this is already risky (a fast polling tick can re-select the same job before the update commits), and it is completely broken for horizontal scaling (Phase 5).

**Root cause:** No atomic "claim" step exists. pgboss uses PostgreSQL advisory locks and `SELECT ... FOR UPDATE SKIP LOCKED` to prevent this; the MSSQL implementation omits the equivalent.

**Recommended fix:** Replace the `find` + `update` pattern with a single atomic `UPDATE ... OUTPUT INSERTED.*` using MSSQL table hints:

```sql
UPDATE TOP (10) job_queue WITH (UPDLOCK, READPAST)
SET state = 'active', startedon = GETUTCDATE()
OUTPUT INSERTED.*
WHERE state IN ('created', 'retry')
  AND (expirein IS NULL OR expirein > GETUTCDATE())
ORDER BY createdon ASC;
```

This should be executed as a raw TypeORM query inside `processJobs()` instead of the ORM `find` + `update` two-step.

---

## Gap 2 — `@ViewEntity` Expression is PostgreSQL-only (High Severity)

**Problem:** `packages/models-server/src/entities/sb-sync-queue.view.entity.ts` has the view SQL hardcoded in the `@ViewEntity({ expression: ... })` decorator using PostgreSQL-specific operators (`pgboss.job`, `pgboss.archive`, `::text`, `::int`, `->`, `->>`). TypeORM uses a single expression regardless of the active engine. For MSSQL, this will either fail at startup or return wrong results.

**Missing from design:** The document proposes creating the MSSQL view via a migration but does not address how the TypeORM entity itself will provide different SQL per engine. The entity needs one of:

- **Option A (Recommended):** Remove the `expression` from the decorator and keep it as a plain `@Entity('sb_sync_queue')` backed by a manually created view, so TypeORM treats it as a regular table-like entity regardless of engine. Both migrations (PostgreSQL and MSSQL) create the view with engine-specific SQL — TypeORM just reads from it.
- **Option B:** Provide two separate entity files and select the correct one in the module based on `DB_ENGINE`.

Option A is simpler and avoids duplicating the entity definition.

---

## Gap 3 — Retry Delay Not Actually Enforced (Medium Severity)

**Problem:** `executeJob()` updates state to `'retry'` but doesn't persist *when* the retry should execute. `processJobs()` picks up all `'retry'` state jobs on every tick (1 second), so the `retryDelay`/`retryBackoff` calculation in the service is computed but **never used** — retries always run on the next poll.

**Recommended fix:** Add a `retryafter` column (`datetime2`) to `JobQueue`. When a job transitions to `'retry'`, set `retryafter = NOW() + calculatedDelay`. Change `processJobs()` to filter `(state = 'retry' AND retryafter <= GETUTCDATE()) OR state = 'created'`.

---

## Gap 4 — Filtered Unique Index May Not Generate Correctly via TypeORM Decorator (Medium Severity)

**Problem:** The design uses the TypeORM `@Index` decorator with a `where` clause for the partial unique index on `singletonKey`:

```typescript
@Index(['singletonKey'], { unique: true, where: "[singletonKey] IS NOT NULL AND [state] IN ('created', 'retry', 'active')" })
```

TypeORM's decorator-based index generation for MSSQL with filtered `where` clauses has known inconsistencies and may generate invalid DDL. Additionally, `state IN ('created', 'retry', 'active')` inside a filtered index is not supported in all MSSQL versions (requires SQL Server 2008+ and the filter cannot reference expressions in some configurations).

**Recommended fix:** Skip the decorator for this index and create it explicitly in the migration via raw SQL:

```sql
CREATE UNIQUE INDEX UX_job_queue_singletonKey_active
ON job_queue (singletonKey)
WHERE singletonKey IS NOT NULL AND state IN ('created', 'retry', 'active');
```

---

## Gap 5 — `cron-parser` Dynamic `require()` and Version Ambiguity (Medium Severity)

**Problem:** `calculateNextRun()` uses `const parser = require('cron-parser')` at runtime inside a method body. Two sub-issues:

1. `cron-parser` v3.x and v4.x have different APIs and import styles (v4 is ESM-first). The document doesn't pin a version.
2. The dynamic `require()` bypasses TypeScript's module resolution and type checking, meaning API usage errors won't be caught at compile time.

**Recommended fix:** Import at the top of the file with a pinned version (`"cron-parser": "^3.1.0"` is the stable CJS version). Use a proper top-level import:

```typescript
import { parseExpression } from 'cron-parser';
// ...
private calculateNextRun(cron: string, timezone?: string): Date {
  const interval = parseExpression(cron, { currentDate: new Date(), tz: timezone || 'UTC' });
  return interval.next().toDate();
}
```

---

## Gap 6 — `JobQueueModule` Registers MSSQL Repositories on PostgreSQL Deployments (Medium Severity)

**Problem:** The proposed `JobQueueModule` always includes `TypeOrmModule.forFeature([JobQueue, JobSchedule])` regardless of the engine. On PostgreSQL deployments, TypeORM will register the `JobQueue` and `JobSchedule` entity metadata and may attempt to synchronize or validate these tables, which don't exist on PostgreSQL.

**Recommended fix:** Make the feature imports conditional:

```typescript
imports: [
  ...(config.DB_ENGINE === 'mssql'
    ? [TypeOrmModule.forFeature([JobQueue, JobSchedule])]
    : []),
],
```

---

## Gap 7 — PostgreSQL-Specific JSON Query Remains in Updated Consumer (Medium Severity)

**Problem:** In `sb-sync.consumer.ts`, the SYNC_SCHEDULER_CHNL worker contains a PostgreSQL-specific query:

```typescript
.where(`"configPublic"->>'sbEnvironmentMetaArn' is not null`)
```

The `->>` operator is PostgreSQL-specific. On MSSQL this would need:

```typescript
.where(`JSON_VALUE(configPublic, '$.sbEnvironmentMetaArn') IS NOT NULL`)
```

The design document's updated consumer code (Section 6) does not address this and copies the same PostgreSQL query unchanged.

**Recommended fix:** Abstract the query using a per-engine utility or add conditional branching based on `DB_ENGINE`. A small helper that returns the right JSON path expression per engine would also benefit other similar queries elsewhere in the codebase.

---

## Gap 8 — `PgBossAdapter.send()` Ignores Null Return (Low Severity)

**Problem:** `pg-boss` v9's `send()` returns `Promise<string | null>` — it returns `null` when a singleton duplicate is detected. The `PgBossAdapter` wraps it and declares the return type as `Promise<string>`, which causes a TypeScript error and a potential runtime `null` reference if the caller uses the returned ID.

**Recommended fix:** Handle `null` explicitly in the adapter, matching the `MssqlJobQueueService` singleton behavior:

```typescript
async send<T>(queueName: string, data: T, options?: JobOptions): Promise<string> {
  const id = await this.boss.send(queueName, data, options);
  if (id === null && options?.singletonKey) {
    // pgboss silently deduped — look up the existing active job
    const [existing] = await this.boss.fetch(queueName);
    return existing?.id ?? 'deduped';
  }
  return id;
}
```

---

## Gap 9 — `sb-sync.controller.ts` `triggerSync()` API Mismatch (Low Severity)

**Problem:** The current `triggerSync()` controller method uses a pg-boss-specific overload:

```typescript
const id = await boss.send({ name: SYNC_SCHEDULER_CHNL });
```

The `IJobQueueService.send()` interface has the signature `send(queueName: string, data: T, options?)`. The design document does not update this controller call to match the new interface.

Additionally, after `send()`, the controller polls `boss.getJobById(id)` and accesses pgboss-internal fields like `job.retrylimit`, `job.retrydelay`, `job.retrybackoff`, `job.expirein`, `job.keepuntil` — these are not part of the `IJobQueueService.Job` type, so the polling response shape needs to be reconciled with the abstraction.

**Recommended fix:** Update the call to `this.jobQueue.send(SYNC_SCHEDULER_CHNL, null)` and narrow the polling response to only fields exposed by `IJobQueueService.Job`.

---

## Gap 10 — Success Criterion #4 Contradicts Dependency Addition (Low Severity)

**Problem:** Success Criterion #4 states:

> ✅ **No New Dependencies:** Only TypeORM and standard libraries

But Phase 2 checklist item 6 explicitly states:

> Add `cron-parser` dependency to `package.json`

These are contradictory.

**Recommended fix:** Update Criterion #4 to:

> ✅ **Minimal New Dependencies:** One small cron-parsing library (`cron-parser`) added for MSSQL path only; no new infrastructure services required.

---

## Gap 11 — Schedule Check Interval Jitter (Low Severity / Informational)

**Problem:** `processSchedules()` runs every 60 seconds. If `SB_SYNC_CRON` is configured for sub-minute intervals (e.g., during testing), scheduled jobs would be missed. Even at 1-minute granularity, the first fire after startup could be delayed up to 60 seconds.

**Recommendation:** Reduce the schedule check interval to 5–10 seconds for more accurate timing, or at minimum document that the MSSQL scheduler has up to 60-second jitter and make both polling intervals configurable via environment variables.

---

## Summary

| Priority | Gap | Action Required |
|----------|-----|----------------|
| 🔴 High | Gap 1 — Race condition | Implement atomic job claim using `UPDATE ... WITH (UPDLOCK, READPAST) OUTPUT INSERTED.*` |
| 🔴 High | Gap 2 — ViewEntity PostgreSQL-only | Switch `@ViewEntity` to `@Entity` with no expression; create view via engine-specific migrations only |
| 🟠 Medium | Gap 3 — Retry delay not enforced | Add `retryafter` column; filter in `processJobs()` |
| 🟠 Medium | Gap 4 — Filtered index via decorator | Create index via raw migration SQL, not TypeORM decorator |
| 🟠 Medium | Gap 5 — cron-parser API/version | Pin version, use top-level import instead of dynamic `require()` |
| 🟠 Medium | Gap 6 — MSSQL repos registered on PG | Conditionally register `TypeOrmModule.forFeature` based on `DB_ENGINE` |
| 🟠 Medium | Gap 7 — PG JSON query in consumer | Add cross-database JSON query abstraction or conditional branching |
| 🟡 Low | Gap 8 — Null return from pgboss | Handle `null` in `PgBossAdapter.send()` |
| 🟡 Low | Gap 9 — `triggerSync()` API mismatch | Update controller `send()` call and polling field access to match interface |
| 🟡 Low | Gap 10 — Contradictory success criterion | Update Criterion #4 wording |
| 🟡 Low | Gap 11 — Schedule jitter | Make check interval configurable; document timing behavior |
