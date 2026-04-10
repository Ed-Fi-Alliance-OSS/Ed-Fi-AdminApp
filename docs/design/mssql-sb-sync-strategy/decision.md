# Design Decisions & Required Improvements (Cluade Sonnet 4.6)
## MSSQL SB Sync Strategy — Consolidated Review

> **Source documents:**
> - Strategy: `docs/design/mssql-sb-sync-strategy/README.md`
> - Technical findings: `findings1.md`
> - Architectural findings: `findings2.md`

**Overall verdict:** The strategy has the right high-level direction and must not be implemented as-is.
The items below are ordered by priority and must be resolved before or during implementation.

---

## 🔴 CRITICAL — Must fix before Phase 2 begins

These issues will cause data corruption, silent job loss, or runtime failures on MSSQL.

---

### D-01 — Atomic job claim required in `processJobs()`

**Problem:** The current design fetches jobs with `find(state IN ('created', 'retry'))` then calls
`update(state = 'active')` as two separate operations. This is a race condition: two overlapping
poll ticks (or two app instances) can claim the same job simultaneously.

**Decision:** Replace the ORM two-step with a single atomic raw SQL statement:

```sql
UPDATE TOP (10) job_queue WITH (UPDLOCK, ROWLOCK, READPAST)
SET state = 'active', startedon = GETUTCDATE()
OUTPUT INSERTED.*
WHERE state IN ('created', 'retry')
  AND (availableAt IS NULL OR availableAt <= GETUTCDATE())
  AND (expirein IS NULL OR expirein > GETUTCDATE())
ORDER BY createdon ASC;
```

Execute via TypeORM `query()` (raw SQL). Remove the `find` + `update` pattern from
`processJobs()` entirely.

**References:** findings1 Gap 1, findings2 §1

---

### D-02 — Crash/stuck-job recovery (lease-based)

**Problem:** If the application crashes after a job is marked `active`, that job stays `active`
forever. The design document does not include any recovery or requeue mechanism.

**Decision:** Add two fields to `JobQueue`:

| Field | Type | Purpose |
|-------|------|---------|
| `leaseUntil` | `datetime2` | Absolute time the lease expires |
| `processedon` | `datetime2` | When the claim was last renewed (optional) |

**Startup sweeper** (runs once on `onApplicationBootstrap` before starting the poll loop):

```sql
UPDATE job_queue
SET state = 'retry', retrycount = retrycount + 1
WHERE state = 'active' AND leaseUntil < GETUTCDATE();
```

Set `leaseUntil = NOW() + jobTimeoutMs` during the atomic claim (D-01). Extend it periodically
for long-running jobs if needed, or simply make the lease long enough for the expected max job
duration.

**References:** findings2 §2

---

### D-03 — Replace `@ViewEntity` expression with a plain `@Entity`

**Problem:** `sb-sync-queue.view.entity.ts` uses `@ViewEntity({ expression: ... })` with
PostgreSQL-specific syntax (`pgboss.job`, `::text`, `->`, `->>`). TypeORM applies the same
expression regardless of engine; MSSQL startup will fail or silently return wrong data.

**Decision:** Remove the `expression` from the decorator. Declare it as a plain `@Entity('sb_sync_queue')`.
Both the PostgreSQL and MSSQL migrations create the underlying view with engine-specific SQL.
TypeORM reads from it as though it were a regular table.

```typescript
// Before
@ViewEntity({ expression: `SELECT ... pgboss.job ...` })
export class SbSyncQueue { ... }

// After
@Entity('sb_sync_queue')
export class SbSyncQueue { ... }
```

No change is needed in the PostgreSQL migration (view already exists). A new MSSQL migration
creates the MSSQL view (the design's Section 5 SQL is correct for MSSQL — keep it).

**References:** findings1 Gap 2, findings2 §6

---

### D-04 — Fix PostgreSQL-only JSON operators in `sb-sync.consumer.ts`

**Problem:** The consumer contains `"configPublic"->>'sbEnvironmentMetaArn'` and
`"configPublic"->>'adminApiUrl'` — PostgreSQL-specific operators. These will throw on MSSQL
even after the queue is implemented, making Phase 2 non-functional.

**Decision:** Abstract JSON field access via a per-engine helper:

```typescript
// packages/api/src/utils/db-json-query.ts
export function jsonValue(column: string, path: string, engine: DbEngine): string {
  return engine === 'mssql'
    ? `JSON_VALUE(${column}, '$.${path}')`
    : `"${column}"->>'${path}'`;
}
```

Apply to every JSON path query in `sb-sync.consumer.ts`. Treat this as a Phase 2 deliverable
gating item — the design's Phase 2 checklist must include it explicitly.

**References:** findings1 Gap 7, findings2 §5

---

### D-05 — Define the complete `SbSyncQueue` entity/migration strategy

**Problem:** The current MSSQL migration (`1709328882890-v7-changes.ts`) creates a *dummy*
`sb_sync_queue` view that returns no rows. The design does not describe how this placeholder
is replaced, how `data`/`output` columns (stored as `nvarchar(max)`) are deserialized back
to objects, or whether the entity stays shared or becomes engine-specific.

**Decision:**
1. Keep a single shared `@Entity('sb_sync_queue')` (see D-03).
2. Add a new MSSQL migration that drops the dummy view and creates the real view (Section 5 SQL).
3. Deserialization of `data` and `output` from `nvarchar(max)` to object: do it in the DTO
   mapping layer (`toSbSyncQueueDto`), not in the entity. Add a note that MSSQL returns JSON
   as a string; use `JSON.parse()` when mapping.

**References:** findings2 §6

---

## 🟠 HIGH — Must fix before Phase 2 is considered complete

These issues make the implementation incorrect or unsafe for production use.

---

### D-06 — Enforce retry delay with `availableAt` column

**Problem:** `executeJob()` computes `nextRetry` but never persists it. `processJobs()` picks
up all `retry` rows immediately on the next poll (1 s). Retry delay and exponential backoff are
silently ignored.

**Decision:** Add `availableAt datetime2 NULL` to `JobQueue`. When transitioning to `retry`:

```typescript
await this.jobRepository.update(job.id, {
  state: 'retry',
  retrycount: job.retrycount + 1,
  availableAt: new Date(Date.now() + nextRetryMs),
  output: JSON.stringify({ error: error.message }),
});
```

Update the atomic claim SQL (D-01) to gate on `availableAt <= GETUTCDATE()`.

**References:** findings1 Gap 3, findings2 §3

---

### D-07 — Make schedule bootstrap idempotent

**Problem:** `schedule()` inserts a new `JobSchedule` row every time the app boots. Multiple
restarts or multiple instances will create duplicate schedule rows, causing the same cron job
to fire multiple times per interval.

**Decision:** Replace `save()` with an upsert keyed on `name`:

```typescript
await this.scheduleRepository.upsert(
  { name: queueName, cron, data: JSON.stringify(data), timezone, nextrun },
  ['name']
);
```

Add a `UNIQUE` constraint on `job_schedule.name` in the migration.

Additionally, protect the schedule-fire loop with `sp_getapplock` (or equivalent advisory lock)
so only one app instance fires the scheduler at a time in multi-instance deployments.

**References:** findings2 §7

---

### D-08 — Fix singleton-key lookup to constrain by active state

**Problem:** On unique-constraint violation, the fallback query is:

```typescript
await this.jobRepository.findOne({ where: { singletonKey: options.singletonKey } });
```

This can return a completed or failed row from a previous run that happened to share the same
`singletonKey`, returning a stale job ID to the caller.

**Decision:** Align the fallback lookup with the filtered index:

```typescript
await this.jobRepository.findOne({
  where: {
    singletonKey: options.singletonKey,
    state: In(['created', 'retry', 'active']),
  },
});
```

**References:** findings2 §8

---

### D-09 — Prevent overlapping poll ticks (guarded loop)

**Problem:** `setInterval(() => this.processJobs(), 1000)` fires every second regardless of
whether the previous tick has finished. If `executeJob()` takes >1 s, the same job window can
be polled twice before the first tick completes (compounding the race condition in D-01).

**Decision:** Replace `setInterval` with a guarded recursive `setTimeout`:

```typescript
private async runJobLoop(): Promise<void> {
  if (!this.isRunning) return;
  try {
    await this.processJobs();
  } finally {
    if (this.isRunning) {
      this.pollingTimer = setTimeout(() => this.runJobLoop(), this.pollIntervalMs);
    }
  }
}
```

Apply the same pattern for `processSchedules()`.

**References:** findings2 §9

---

### D-10 — Reduce `job_schedule` table scope for v1

**Problem:** The `job_schedule` table and the generic `schedule()` API introduce significant
surface area (persistence, upsert, leader election, nextrun calculation). The app currently has
*one* recurring job driven by `SB_SYNC_CRON`. This is over-engineered for v1.

**Decision (v1 scope):**
- Keep the `job_queue` table and service.
- Remove `job_schedule` table and the `schedule()` method from `IJobQueueService` for v1.
- In `MssqlJobQueueService`, use a single in-process cron loop (powered by `cron-parser`) that
  enqueues `SYNC_SCHEDULER_CHNL` on the configured `SB_SYNC_CRON` schedule.
- Protect it with `sp_getapplock` so only one instance enqueues at a time.

If a generic scheduler is needed later, add it in Phase 4 with full leader-election support.

**References:** findings2 §4, §Recommended alternative

---

### D-11 — Create filtered unique index via raw migration SQL, not decorator

**Problem:** TypeORM's `@Index` decorator with a filtered `where` clause has known DDL
generation issues on MSSQL and may produce invalid SQL in some SQL Server versions.

**Decision:** Remove the `@Index` decorator for `singletonKey` from the entity. Create the
index explicitly in the migration:

```sql
CREATE UNIQUE INDEX UX_job_queue_singletonKey_active
ON job_queue (singletonKey)
WHERE singletonKey IS NOT NULL
  AND state IN ('created', 'retry', 'active');
```

**References:** findings1 Gap 4

---

## 🟡 MEDIUM — Should fix before shipping

These are correctness or maintainability issues that do not cause immediate data loss but
will cause problems in practice.

---

### D-12 — Conditionally register MSSQL repositories

**Problem:** `JobQueueModule` unconditionally imports `TypeOrmModule.forFeature([JobQueue, JobSchedule])`.
On PostgreSQL deployments TypeORM will register entity metadata for tables that don't exist,
potentially causing validation errors.

**Decision:**

```typescript
imports: [
  ...(config.DB_ENGINE === 'mssql'
    ? [TypeOrmModule.forFeature([JobQueue, JobSchedule])]
    : []),
],
```

**References:** findings1 Gap 6

---

### D-13 — Fix `cron-parser` import style and pin version

**Problem:** `calculateNextRun()` uses `const parser = require('cron-parser')` (dynamic runtime
require). This bypasses TypeScript module resolution, cannot be type-checked, and risks API
breakage between v3 and v4.

**Decision:** Add `"cron-parser": "^3.1.0"` to `package.json`. Use a top-level import:

```typescript
import { parseExpression } from 'cron-parser';

private calculateNextRun(cron: string, timezone?: string): Date {
  const interval = parseExpression(cron, { currentDate: new Date(), tz: timezone || 'UTC' });
  return interval.next().toDate();
}
```

**References:** findings1 Gap 5

---

### D-14 — Handle null return from `PgBossAdapter.send()`

**Problem:** `pg-boss` v9 `send()` returns `Promise<string | null>` (null = singleton deduped).
The adapter declares `Promise<string>`, causing a TypeScript error and potential null-reference
in callers.

**Decision:** Handle null explicitly:

```typescript
async send<T>(queueName: string, data: T, options?: JobOptions): Promise<string> {
  const id = await this.boss.send(queueName, data, options);
  if (id === null) {
    // pgboss silently deduped the singleton — return a stable sentinel or look up active job
    return options?.singletonKey ?? 'deduped';
  }
  return id;
}
```

**References:** findings1 Gap 8

---

### D-15 — Update `triggerSync()` controller to match `IJobQueueService` interface

**Problem:** The controller calls `boss.send({ name: SYNC_SCHEDULER_CHNL })` (pg-boss-specific
overload) and accesses internal pgboss fields (`retrylimit`, `retrydelay`, etc.) which are not
on `IJobQueueService.Job`.

**Decision:** Update the call to `this.jobQueue.send(SYNC_SCHEDULER_CHNL, null)` and narrow the
polling response to only fields defined in `IJobQueueService.Job`. Remove access to pgboss-internal
fields from the controller.

**References:** findings1 Gap 9

---

### D-16 — Make polling intervals configurable and document schedule jitter

**Problem:** 1-second job polling and 60-second schedule check are hard-coded. If `SB_SYNC_CRON`
runs at sub-minute intervals, scheduled fires will be missed entirely. Even at 1-minute granularity,
the first fire after startup can be delayed up to 60 seconds.

**Decision:**
- Expose `MSSQL_JOB_POLL_MS` (default `1000`) and `MSSQL_SCHEDULE_POLL_MS` (default `10000`)
  as environment configuration options.
- Reduce the default schedule check interval to **10 seconds** to minimize jitter.
- Document that MSSQL scheduling has up to `MSSQL_SCHEDULE_POLL_MS` jitter (vs. near-zero for pgboss LISTEN/NOTIFY).

**References:** findings1 Gap 11

---

## 🔵 LOW — Documentation / Consistency

---

### D-17 — Correct contradictory success criterion #4

**Problem:** Success Criterion #4 states "No New Dependencies: Only TypeORM and standard
libraries." Phase 2 checklist item 6 explicitly adds `cron-parser`.

**Decision:** Update Criterion #4:

> ✅ **Minimal New Dependencies:** One small cron-parsing library (`cron-parser`) added for
> the MSSQL path only; no new infrastructure services required.

**References:** findings1 Gap 10

---

## Phase Checklist — Required Additions

The following items must be added to the existing phase checklists in the strategy document:

### Phase 1 additions
- [ ] Update `PgBossAdapter.send()` to handle null return (D-14)
- [ ] Update `triggerSync()` controller to use `IJobQueueService` interface (D-15)
- [ ] Apply conditional `TypeOrmModule.forFeature` registration (D-12)

### Phase 2 additions
- [ ] Add `availableAt` and `leaseUntil` columns to `JobQueue` entity (D-06, D-02)
- [ ] Add startup sweeper to recover stale `active` jobs (D-02)
- [ ] Implement atomic job claim with `UPDATE ... WITH (UPDLOCK, READPAST) OUTPUT INSERTED.*` (D-01)
- [ ] Replace `setInterval` with guarded `setTimeout` loop (D-09)
- [ ] Make schedule bootstrap idempotent via upsert + unique constraint on `name` (D-07)
- [ ] Add `sp_getapplock` scheduler leader protection (D-07, D-10)
- [ ] Remove `@ViewEntity` expression; declare `SbSyncQueue` as plain `@Entity` (D-03)
- [ ] Replace dummy MSSQL `sb_sync_queue` view in migration (D-05)
- [ ] Replace PostgreSQL JSON operators in `sb-sync.consumer.ts` with cross-engine helper (D-04)
- [ ] Fix singleton fallback lookup to filter by active states (D-08)
- [ ] Create filtered unique index via raw migration SQL (D-11)
- [ ] Pin `cron-parser@^3.1.0`; use top-level import (D-13)
- [ ] Reduce/simplify `job_schedule` scope — prefer in-process cron loop for v1 (D-10)

### Phase 3 additions
- [ ] Validate atomic claim prevents duplicate execution under concurrent load (D-01)
- [ ] Validate stale-job recovery after simulated crash (D-02)
- [ ] Validate retry delay is actually enforced (D-06)

---

## Summary Table

| ID | Priority | Area | Decision |
|----|----------|------|---------|
| D-01 | 🔴 Critical | Concurrency | Atomic `UPDATE ... OUTPUT INSERTED.*` claim |
| D-02 | 🔴 Critical | Reliability | Add `leaseUntil`; startup sweeper for stuck jobs |
| D-03 | 🔴 Critical | Entity | Replace `@ViewEntity(expression)` with plain `@Entity` |
| D-04 | 🔴 Critical | Query compat | Abstract PostgreSQL JSON operators for MSSQL |
| D-05 | 🔴 Critical | Migration | Define full MSSQL `sb_sync_queue` view replacement strategy |
| D-06 | 🟠 High | Retry | Add `availableAt`; enforce retry delay in poll filter |
| D-07 | 🟠 High | Scheduling | Idempotent schedule upsert + `sp_getapplock` leader guard |
| D-08 | 🟠 High | Singleton | Constrain singleton fallback query by active state |
| D-09 | 🟠 High | Polling | Replace `setInterval` with guarded `setTimeout` loop |
| D-10 | 🟠 High | Scope | Remove generic `job_schedule` table from v1 |
| D-11 | 🟠 High | Schema | Create filtered unique index via raw migration SQL |
| D-12 | 🟡 Medium | Module | Conditional `TypeOrmModule.forFeature` by engine |
| D-13 | 🟡 Medium | Deps | Pin `cron-parser@^3.1.0`; use top-level ESM import |
| D-14 | 🟡 Medium | PgBoss | Handle null return from `PgBossAdapter.send()` |
| D-15 | 🟡 Medium | Controller | Update `triggerSync()` to use `IJobQueueService` interface |
| D-16 | 🟡 Medium | Config | Make poll intervals configurable; reduce schedule jitter |
| D-17 | 🔵 Low | Docs | Fix contradictory success criterion #4 |
