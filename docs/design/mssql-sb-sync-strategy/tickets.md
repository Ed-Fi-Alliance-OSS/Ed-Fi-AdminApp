# Implementation Tickets — MSSQL SB Sync Strategy

> Tickets are grouped by phase and ordered within each phase by dependency.
> Decision references (D-xx) link back to `docs/design/decision.md`.

---

## Phase 1 — Abstraction Layer

Goal: Introduce the `IJobQueueService` interface and wrap pgboss behind it with zero regression
on PostgreSQL. No MSSQL-specific code ships in this phase.

---

### T1-01 — Create `IJobQueueService` Abstraction Interface

**Summary**
Define the shared contract that both the pgboss adapter (PostgreSQL) and the custom table-based
queue (MSSQL) must implement.

**Context**
The SB Sync process currently calls pgboss APIs directly throughout `sb-sync.consumer.ts`,
`sb-sync.controller.ts`, and the environment/tenant controllers. Before introducing any MSSQL
implementation, a typed interface must exist so both implementations can be injected
interchangeably via NestJS dependency injection.

**Acceptance Criteria**
- [ ] File `packages/api/src/sb-sync/job-queue/job-queue.interface.ts` exists and exports:
  - `IJobQueueService` interface with methods: `start`, `stop`, `send`, `schedule`, `work`, `getJobById`
  - `Job<T>` type with fields: `id`, `name`, `data`, `state`, `createdon`, `startedon`, `completedon`, `output`, `retrycount`
  - `JobOptions` type with fields: `singletonKey`, `expireInHours`, `retryLimit`, `retryDelay`, `retryBackoff`
  - `JobState` union type covering: `created`, `retry`, `active`, `completed`, `expired`, `cancelled`, `failed`
  - `ScheduleOptions` type with field: `tz`
- [ ] All types are exported from the package index or directly importable
- [ ] No runtime code — interface file only
- [ ] TypeScript compiles with no errors

**Dependencies**
None

---

### T1-02 — Implement `PgBossAdapter` (PostgreSQL Wrapper)

**Summary**
Wrap the existing pgboss instance behind `IJobQueueService` so the rest of the application uses
only the abstraction. Fix the null return from `boss.send()` for singleton deduplication (D-14).

**Context**
pgboss v9's `send()` returns `Promise<string | null>` — null when a singleton duplicate is
silently skipped. The current code ignores this, causing a TypeScript type error and a potential
null-reference runtime crash in callers that use the returned job ID. The adapter must handle
this case explicitly.

The adapter should delegate every method to the underlying `PgBoss` instance without changing
any pgboss behavior. Lifecycle (`start`, `stop`) and scheduling (`schedule`) continue to be
handled by pgboss internally.

**Acceptance Criteria**
- [ ] File `packages/api/src/sb-sync/job-queue/pg-boss-adapter.service.ts` exists
- [ ] `PgBossAdapter` implements `IJobQueueService` and `OnApplicationShutdown`
- [ ] `send()` handles `null` return: when pgboss returns null (singleton deduped) the adapter returns `options?.singletonKey ?? 'deduped'` instead of propagating null
- [ ] `send()` return type is `Promise<string>` — no TypeScript errors
- [ ] All other methods delegate directly to the pgboss instance
- [ ] `onApplicationShutdown` calls `stop()` gracefully
- [ ] Existing PostgreSQL sync functionality is unaffected

**Dependencies**
- T1-01

---

### T1-03 — Create `JobQueueModule` with Engine-Conditional Factory

**Summary**
Create a NestJS module that selects the correct `IJobQueueService` implementation at startup
based on `DB_ENGINE` configuration and conditionally registers TypeORM repositories to avoid
errors on PostgreSQL deployments (D-12).

**Context**
If `TypeOrmModule.forFeature([JobQueue])` is registered unconditionally, TypeORM will attempt to
validate the `job_queue` table on PostgreSQL where it does not exist. The factory and the feature
import must both be gated on `config.DB_ENGINE === 'mssql'`.

For Phase 1, the MSSQL branch of the factory can return a placeholder or simply be wired up
ahead of the Phase 2 implementation.

**Acceptance Criteria**
- [ ] File `packages/api/src/sb-sync/job-queue/job-queue.module.ts` exists
- [ ] `TypeOrmModule.forFeature([JobQueue])` is imported **only** when `DB_ENGINE === 'mssql'`
- [ ] Factory provides `'IJobQueueService'` token with the correct implementation per engine
- [ ] `PgBossAdapter` is instantiated and returned for `DB_ENGINE !== 'mssql'`
- [ ] Module is marked `@Global()` and exports `'IJobQueueService'`
- [ ] PostgreSQL integration tests pass without `job_queue` table existing

**Dependencies**
- T1-01
- T1-02

---

### T1-04 — Update `SbSyncConsumer` to Inject `IJobQueueService`

**Summary**
Replace the direct pgboss injection in `SbSyncConsumer` with the `IJobQueueService` abstraction
token so the consumer works identically on both database engines.

**Context**
`sb-sync.consumer.ts` currently imports and injects the pgboss instance directly. After this
ticket the consumer must only interact with `IJobQueueService`. The consumer also contains
PostgreSQL-only JSON operators that will be addressed in Phase 2 (T2-09); add a `// TODO(T2-09)`
comment at those lines to track the work.

**Acceptance Criteria**
- [ ] `SbSyncConsumer` injects `@Inject('IJobQueueService') private readonly jobQueue: IJobQueueService`
- [ ] All `boss.*` calls replaced with `this.jobQueue.*` equivalents
- [ ] `onModuleInit` calls `this.jobQueue.schedule(...)` and `this.jobQueue.work(...)` unchanged in behavior
- [ ] `onModuleDestroy` calls `this.jobQueue.stop()`
- [ ] PostgreSQL-only JSON operators (`.where("configPublic"->>'...')`) left in place with `// TODO(T2-09)` comment
- [ ] All existing unit tests for `SbSyncConsumer` pass
- [ ] End-to-end PostgreSQL sync works in a dev environment

**Dependencies**
- T1-03

---

### T1-05 — Update Controllers to Use `IJobQueueService`

**Summary**
Replace direct pgboss references in `sb-sync.controller.ts`,
`sb-environments-global.controller.ts`, and `edfi-tenants-global.controller.ts` with the
`IJobQueueService` abstraction. Fix the `triggerSync()` API mismatch (D-15).

**Context**
`sb-sync.controller.ts#triggerSync()` currently calls `boss.send({ name: SYNC_SCHEDULER_CHNL })`
using a pgboss-specific overload that does not match the `IJobQueueService.send(queueName, data,
options?)` signature. It also accesses pgboss-internal fields (`retrylimit`, `retrydelay`,
`retrybackoff`, `expirein`, `keepuntil`) from the returned job object, which are not on
`IJobQueueService.Job`. These must be removed from the polling response.

**Acceptance Criteria**
- [ ] All three controllers inject `@Inject('IJobQueueService') private readonly jobQueue: IJobQueueService`
- [ ] `triggerSync()` calls `this.jobQueue.send(SYNC_SCHEDULER_CHNL, null)` (standard interface signature)
- [ ] The polling response in `triggerSync()` only accesses fields defined on `IJobQueueService.Job`: `id`, `name`, `data`, `state`, `createdon`, `startedon`, `completedon`, `output`, `retrycount`
- [ ] pgboss-internal fields (`retrylimit`, `retrydelay`, `retrybackoff`, `expirein`, `keepuntil`) are removed from the polling response DTO
- [ ] No TypeScript compilation errors
- [ ] Existing controller unit tests pass

**Dependencies**
- T1-03

---

## Phase 2 — MSSQL Implementation

Goal: Deliver a safe, production-ready MSSQL queue that handles concurrency, crash recovery,
retry delays, and in-process scheduling. All critical (D-01 through D-05) and high-severity
(D-06 through D-11) decisions are addressed in this phase.

---

### T2-01 — Create `JobQueue` Entity with Safety Fields

**Summary**
Define the `JobQueue` TypeORM entity for MSSQL with all required columns including the new
`availableAt` (retry delay enforcement) and `leaseUntil` (crash recovery) fields. Do **not**
include a `JobSchedule` entity — scheduling is handled in-process (D-10).

**Context**
The entity must omit the `@Index` decorator for `singletonKey` because TypeORM filtered index
DDL generation is unreliable on MSSQL (D-11). The filtered unique index will be created via
raw SQL in the migration (T2-07). The `@Index` decorator for `(name, state)` is safe to keep
since it does not use a WHERE clause.

**Acceptance Criteria**
- [ ] File `packages/models-server/src/entities/job-queue.entity.ts` exists and exports `JobQueue`
- [ ] `JobQueue` has all columns: `id`, `name`, `data`, `state`, `createdon`, `startedon`, `completedon`, `output`, `retrycount`, `retrylimit`, `retrydelay`, `retrybackoff`, `expirein`, `singletonKey`, `keepuntil`, `availableAt`, `leaseUntil`
- [ ] `availableAt datetime2 NULLABLE` — controls when a retrying job becomes claimable (D-06)
- [ ] `leaseUntil datetime2 NULLABLE` — set during atomic claim; used by crash-recovery sweeper (D-02)
- [ ] `@Index(['name', 'state'])` composite index is present
- [ ] No `@Index` decorator on `singletonKey` (created via raw SQL in T2-07)
- [ ] No `JobSchedule` entity or class in this file
- [ ] TypeScript compiles with no errors

**Dependencies**
- T1-01

---

### T2-02 — Implement Atomic Job Claim (`processJobs`)

**Summary**
Replace the non-atomic `find` + `update` pattern in `processJobs()` with a single SQL statement
that atomically marks up to 10 eligible jobs as `active` using MSSQL locking hints (D-01).

**Context**
The original design calls `this.jobRepository.find(...)` then `this.jobRepository.update(...)`
as two separate round-trips. Between those two calls, another poll tick or another app instance
can select the same rows, causing duplicate job execution. MSSQL's `UPDATE ... WITH (UPDLOCK,
ROWLOCK, READPAST) OUTPUT INSERTED.*` pattern solves this atomically without requiring a
distributed lock.

The claim also sets `leaseUntil = NOW() + 5 minutes` to support crash recovery (T2-03).

The `availableAt` filter ensures retrying jobs with a future `availableAt` are not claimed
prematurely (T2-05).

**Acceptance Criteria**
- [ ] `processJobs()` executes a single raw SQL statement via `this.jobRepository.query()`
- [ ] SQL uses `UPDATE TOP (10) ... WITH (UPDLOCK, ROWLOCK, READPAST) OUTPUT INSERTED.*`
- [ ] SQL filters: `state IN ('created', 'retry') AND (availableAt IS NULL OR availableAt <= GETUTCDATE()) AND (expirein IS NULL OR expirein > GETUTCDATE())`
- [ ] SQL sets `state = 'active'`, `startedon = GETUTCDATE()`, `leaseUntil = <now + 5 min>`
- [ ] Returned rows are passed to `executeJob()` as fire-and-forget (not awaited sequentially)
- [ ] Unit test: two concurrent calls to `processJobs()` do not claim the same job
- [ ] No ORM `find` + `update` two-step remains in the method

**Dependencies**
- T2-01

---

### T2-03 — Implement Startup Crash-Recovery Sweeper

**Summary**
Add a `recoverStaleJobs()` method that requeues any `active` jobs whose `leaseUntil` has
expired, indicating the previous process crashed after claiming but before completing (D-02).

**Context**
Without a lease-based sweeper, a crash mid-job leaves the row in `active` state permanently.
The sweeper runs once on `onApplicationBootstrap`, before the polling loop starts, so no new
ticks can interfere with the recovery.

**Acceptance Criteria**
- [ ] `recoverStaleJobs()` executes `UPDATE job_queue SET state = 'retry', retrycount = retrycount + 1 WHERE state = 'active' AND leaseUntil < GETUTCDATE()`
- [ ] Method is called in `start()` before `runJobLoop()` and `runScheduleLoop()`
- [ ] Number of recovered jobs is logged at `WARN` level if > 0
- [ ] Unit test: given a row with `state = 'active'` and `leaseUntil` in the past, after `recoverStaleJobs()` the row is in `state = 'retry'` with `retrycount` incremented
- [ ] Unit test: a row with `state = 'active'` and `leaseUntil` in the future is NOT touched

**Dependencies**
- T2-01

---

### T2-04 — Implement Guarded Polling Loop (Replace `setInterval`)

**Summary**
Replace `setInterval`-based polling with a guarded recursive `setTimeout` loop so a slow job
execution cannot cause overlapping poll ticks (D-09). Apply the same pattern to the schedule
check loop.

**Context**
`setInterval` fires unconditionally every N milliseconds regardless of whether the previous
invocation has finished. If `processJobs()` or `executeJob()` takes longer than the interval,
two poll cycles run concurrently — compounding the duplicate-claim risk even with the atomic
SQL from T2-02.

**Acceptance Criteria**
- [ ] `start()` calls `this.runJobLoop()` and `this.runScheduleLoop()` (not `setInterval`)
- [ ] `runJobLoop()` calls `processJobs()`, then schedules the next tick with `setTimeout` in a `finally` block
- [ ] `runScheduleLoop()` calls `processSchedules()`, then schedules the next tick with `setTimeout` in a `finally` block
- [ ] Both loops respect `this.isRunning` and stop scheduling further ticks when false
- [ ] `stop()` clears the `setTimeout` handles via `clearTimeout`
- [ ] `pollIntervalMs` read from `config.MSSQL_JOB_POLL_MS ?? 1000` (D-16)
- [ ] `scheduleIntervalMs` read from `config.MSSQL_SCHEDULE_POLL_MS ?? 10000` (D-16)
- [ ] Unit test: calling `stop()` prevents any further poll ticks

**Dependencies**
- T2-02

---

### T2-05 — Implement In-Process Cron Scheduler with Leader Guard

**Summary**
Implement `schedule()` and `processSchedules()` using an in-process registry and `cron-parser`
instead of a persistent `job_schedule` database table (D-10). Protect against multi-instance
duplicate fires using `sp_getapplock` (D-07).

**Context**
The original design persisted schedule rows to a `job_schedule` table and re-inserted a row
on every app boot, creating duplicates across restarts. For v1, the app only has one recurring
schedule (`SYNC_SCHEDULER_CHNL`). Storing it in-process via a `Map` is simpler, avoids the
duplicate-row problem, and removes an entire database table from scope.

`sp_getapplock` provides an advisory lock scoped to the SQL Server session that prevents two
app instances from enqueueing the same scheduled job simultaneously.

**Acceptance Criteria**
- [ ] `schedule()` stores the cron config in an in-memory `Map` — no DB write
- [ ] `processSchedules()` iterates the in-memory map and computes the next fire time using `parseExpression` from `cron-parser`
- [ ] On first run after startup, the schedule fires immediately if no `lastScheduleFire` record exists
- [ ] Before enqueuing, `tryAcquireSchedulerLock(queueName)` calls `sp_getapplock` with timeout 0 (non-blocking)
- [ ] If the lock is not acquired (another instance is firing), the current instance skips enqueue silently
- [ ] After enqueuing, `releaseSchedulerLock(queueName)` releases the advisory lock
- [ ] `lastScheduleFire` map is updated after a successful enqueue
- [ ] Unit test: `schedule()` + `processSchedules()` results in `send()` being called after the cron interval elapses
- [ ] Unit test: if `tryAcquireSchedulerLock` returns false, `send()` is not called

**Dependencies**
- T2-04
- T2-09 (cron-parser must be pinned and imported correctly)

---

### T2-06 — Enforce Retry Delay via `availableAt`

**Summary**
Persist the computed retry delay into `availableAt` when transitioning a job to `retry` state,
so `processJobs()` (T2-02) does not claim it until the delay has elapsed (D-06).

**Context**
The original design computed `nextRetry` inside `executeJob()` but only logged it — the value
was never stored. As a result, retrying jobs were picked up on the very next poll tick (1 s),
making `retryDelay` and `retryBackoff` options effectively non-functional.

**Acceptance Criteria**
- [ ] When `executeJob()` transitions a job to `retry`, it sets `availableAt = new Date(Date.now() + nextRetryMs)`
- [ ] `nextRetryMs` uses exponential backoff when `retrybackoff = true`: `2^retrycount * retrydelay`
- [ ] `nextRetryMs` uses flat delay when `retrybackoff = false`: `retrydelay || 1000`
- [ ] The atomic claim SQL in T2-02 already gates on `availableAt <= GETUTCDATE()` — no extra change needed
- [ ] Unit test: a job with `retryDelay: 5000` is not claimable until 5 s after failure
- [ ] Unit test: a job with `retryBackoff: true` doubles its delay on each retry

**Dependencies**
- T2-02

---

### T2-07 — MSSQL Database Migration

**Summary**
Create a new MSSQL migration that provisions the `job_queue` table, the filtered unique index
on `singletonKey`, and replaces the existing dummy `sb_sync_queue` view with the real
production view (D-05, D-11).

**Context**
The current MSSQL migration `1709328882890-v7-changes.ts` creates a dummy `sb_sync_queue` view
that returns no rows as a placeholder. This migration must drop that placeholder and create the
real view backed by `job_queue`. The `singletonKey` filtered unique index must be created via
raw SQL because TypeORM `@Index` decorator DDL for filtered indexes is unreliable on MSSQL (D-11).

**Acceptance Criteria**
- [ ] New migration file created under `packages/api/src/database/migrations/mssql/`
- [ ] Migration `up()` creates `job_queue` table with all columns from T2-01 (including `availableAt`, `leaseUntil`)
- [ ] Migration `up()` creates `CREATE INDEX IX_job_queue_name_state ON job_queue (name, state)`
- [ ] Migration `up()` creates filtered unique index:
  ```sql
  CREATE UNIQUE INDEX UX_job_queue_singletonKey_active
  ON job_queue (singletonKey)
  WHERE singletonKey IS NOT NULL AND state IN ('created', 'retry', 'active');
  ```
- [ ] Migration `up()` drops the dummy `sb_sync_queue` view and creates the real MSSQL view (from strategy doc Section 5)
- [ ] Migration `down()` reverses all changes cleanly
- [ ] `npm run migrations:run` succeeds on a clean MSSQL database
- [ ] `npm run migrations:revert` succeeds

**Dependencies**
- T2-01

---

### T2-08 — Fix `SbSyncQueue` Entity: `@ViewEntity` → `@Entity`

**Summary**
Remove the PostgreSQL-specific `expression` from `SbSyncQueue`'s `@ViewEntity` decorator and
replace it with a plain `@Entity('sb_sync_queue')` so TypeORM can read from the view on both
engines without applying engine-specific SQL at startup (D-03).

**Context**
`packages/models-server/src/entities/sb-sync-queue.view.entity.ts` currently has:
```typescript
@ViewEntity({ expression: `SELECT ... pgboss.job ... ::text ... ->> ...` })
```
TypeORM applies this expression regardless of the active engine. On MSSQL this SQL is invalid
and will cause a startup failure or incorrect data. The correct fix is to remove the `expression`
entirely and let the migration-created view define the SQL per engine.

**Acceptance Criteria**
- [ ] `sb-sync-queue.view.entity.ts` uses `@Entity('sb_sync_queue')` with no `expression` property
- [ ] The column definitions remain identical (no change to the shape of the entity)
- [ ] PostgreSQL still reads from its existing materialized view (no PostgreSQL migration needed)
- [ ] MSSQL reads from the real view created in T2-07
- [ ] `toSbSyncQueueDto()` (or equivalent DTO mapper) uses `JSON.parse()` when mapping `data` and `output` to handle MSSQL `nvarchar(max)` values
- [ ] Existing PostgreSQL unit/integration tests involving `SbSyncQueue` pass

**Dependencies**
- T2-07

---

### T2-09 — Abstract Cross-Engine JSON Query Operators

**Summary**
Create a `jsonValue()` utility function and replace all PostgreSQL-only JSON path operators
(`->>`) in `sb-sync.consumer.ts` with calls to this helper (D-04).

**Context**
The consumer's `SYNC_SCHEDULER_CHNL` worker uses:
```typescript
.where(`"configPublic"->>'sbEnvironmentMetaArn' is not null`)
```
The `->>` operator is PostgreSQL-specific. On MSSQL the equivalent is:
```typescript
.where(`JSON_VALUE(configPublic, '$.sbEnvironmentMetaArn') IS NOT NULL`)
```
Without this fix, the MSSQL sync will throw a SQL syntax error even after the queue is
implemented, blocking Phase 2 end-to-end functionality.

**Acceptance Criteria**
- [ ] File `packages/api/src/utils/db-json-query.ts` created with an exported `jsonValue(column: string, path: string, engine: DbEngine): string` function
- [ ] Returns `JSON_VALUE(${column}, '$.${path}')` for MSSQL
- [ ] Returns `"${column}"->>'${path}'` for PostgreSQL
- [ ] All `->>'` usages in `sb-sync.consumer.ts` replaced with `jsonValue(...)` calls
- [ ] Unit tests for `jsonValue()` cover both engines
- [ ] MSSQL end-to-end sync query executes without SQL syntax errors

**Dependencies**
- T1-04

---

### T2-10 — Pin `cron-parser` and Fix Import Style

**Summary**
Add `cron-parser@^3.1.0` to `package.json` and replace the dynamic `require('cron-parser')`
call in `MssqlJobQueueService` with a top-level static import (D-13).

**Context**
`cron-parser` v3.x (CommonJS) and v4.x (ESM-first) have incompatible APIs. The current dynamic
`require()` bypasses TypeScript module resolution, making API mismatches invisible at compile
time. Pinning to v3.1.0 and using a top-level `import { parseExpression } from 'cron-parser'`
ensures type safety and consistent behavior.

**Acceptance Criteria**
- [ ] `"cron-parser": "^3.1.0"` added to `package.json` dependencies
- [ ] `npm install` completed successfully
- [ ] Top-level `import { parseExpression } from 'cron-parser'` at the top of `mssql-job-queue.service.ts`
- [ ] No `require('cron-parser')` anywhere in the codebase
- [ ] `calculateNextRun()` uses `parseExpression(cron, { currentDate, tz })` directly
- [ ] TypeScript compiles without errors
- [ ] Unit test for `calculateNextRun()` verifies correct next-fire date for a known cron expression

**Dependencies**
- T2-01

---

## Phase 3 — Integration & Validation

Goal: Confirm the complete MSSQL implementation works end-to-end, is safe under concurrent
load, recovers from crashes, and does not regress PostgreSQL behavior.

---

### T3-01 — End-to-End MSSQL Sync Validation

**Summary**
Run the full SB Sync flow (scheduled sync, manual environment refresh, manual tenant refresh)
on a real MSSQL database and verify that job status is visible in the UI.

**Context**
This is the primary acceptance gate for Phase 2. All three sync channels (`SYNC_SCHEDULER_CHNL`,
`ENV_SYNC_CHNL`, `TENANT_SYNC_CHNL`) must produce jobs that are tracked in `job_queue`, visible
via the `sb_sync_queue` view, and surfaced correctly in the Admin App UI.

**Acceptance Criteria**
- [ ] App starts cleanly against MSSQL (`DB_ENGINE=mssql`) with no TypeORM errors
- [ ] Scheduled sync fires according to `SB_SYNC_CRON` (within `MSSQL_SCHEDULE_POLL_MS` jitter)
- [ ] Manual environment refresh via `POST /:sbEnvironmentId/refresh` creates a job and returns status
- [ ] Manual tenant sync creates a job and returns status
- [ ] Completed, failed, and retrying jobs are visible in the UI job queue panel
- [ ] `hasChanges` flag is correctly populated in the view
- [ ] PostgreSQL deployment passes all existing sync tests without modification (regression gate)
- [ ] Deployment guide created for MSSQL users

**Dependencies**
- T2-08
- T2-09

---

### T3-02 — Concurrency and Crash-Recovery Validation

**Summary**
Validate that the atomic job claim prevents duplicate execution under concurrent load, and that
the startup sweeper correctly requeues abandoned jobs after a simulated crash (D-01, D-02).

**Context**
The correctness of the MSSQL queue depends on two behaviors that cannot be verified by unit
tests alone: (1) that two app instances or overlapping poll ticks never execute the same job
twice, and (2) that a crash mid-job does not strand a row in `active` state.

**Acceptance Criteria**
- [ ] Integration test: two `MssqlJobQueueService` instances polling the same database simultaneously do not execute the same job twice (verify via job execution log/counter)
- [ ] Integration test: simulate a crash by setting a job's `state = 'active'` with `leaseUntil` in the past; after calling `recoverStaleJobs()`, the row is in `retry` with incremented `retrycount`
- [ ] Integration test: a retrying job with `availableAt` 10 s in the future is not claimed by `processJobs()` until after that time
- [ ] Load test: 100 jobs enqueued and processed without any duplicate executions or stuck-active rows
- [ ] Results documented (timing, error rate, duplicate count)

**Dependencies**
- T2-02
- T2-03
- T2-06

---

### T3-03 — Documentation and Configuration Update

**Summary**
Update all relevant documentation to reflect the MSSQL implementation, document behavioral
differences from pgboss, and ensure configuration references are accurate.

**Context**
The strategy document, `sb-sync-functionality.md`, and the configuration reference must all
reflect the new `MSSQL_JOB_POLL_MS` and `MSSQL_SCHEDULE_POLL_MS` environment variables, the
scheduling jitter characteristic of the polling approach, and the deployment steps for MSSQL
users.

**Acceptance Criteria**
- [ ] `docs/design/mssql-sb-sync-strategy.md` reflects all Phase 2 changes
- [ ] `sb-sync-functionality.md` updated to cover MSSQL queue behavior
- [ ] Configuration reference documents `DB_ENGINE`, `MSSQL_JOB_POLL_MS`, `MSSQL_SCHEDULE_POLL_MS`
- [ ] Behavioral differences documented: MSSQL scheduling has up to `MSSQL_SCHEDULE_POLL_MS` (default 10 s) jitter vs. near-zero for pgboss LISTEN/NOTIFY
- [ ] Deployment guide for new MSSQL installations includes migration steps
- [ ] CHANGELOG / release notes entry prepared

**Dependencies**
- T3-01
- T3-02

---

## Ticket Dependency Map

```
T1-01 ──► T1-02 ──► T1-03 ──► T1-04 ──► T1-05
                      │
                      ▼
T2-01 ──────────────────────────────────────────►T2-07──►T2-08──►T3-01
  │                                                              ▲
  ├──►T2-02──►T2-04──►T2-05                                     │
  │     │                                                        │
  │     ├──►T2-03                                                │
  │     │                                                        │
  │     └──►T2-06                                                │
  │                                                              │
  └──►T2-10──►T2-05                                             │
                                                                │
T1-04──►T2-09──────────────────────────────────────────────────┘
              │
              ▼
           T3-02──►T3-03
```

## Summary

| Ticket | Phase | Priority | Decision Refs |
|--------|-------|----------|---------------|
| T1-01 | 1 | — | — |
| T1-02 | 1 | — | D-14 |
| T1-03 | 1 | — | D-12 |
| T1-04 | 1 | — | — |
| T1-05 | 1 | — | D-15 |
| T2-01 | 2 | 🔴 Critical | D-02, D-06, D-11 |
| T2-02 | 2 | 🔴 Critical | D-01 |
| T2-03 | 2 | 🔴 Critical | D-02 |
| T2-04 | 2 | 🟠 High | D-09, D-16 |
| T2-05 | 2 | 🟠 High | D-07, D-10 |
| T2-06 | 2 | 🟠 High | D-06 |
| T2-07 | 2 | 🔴 Critical | D-05, D-11 |
| T2-08 | 2 | 🔴 Critical | D-03, D-05 |
| T2-09 | 2 | 🔴 Critical | D-04 |
| T2-10 | 2 | 🟡 Medium | D-13 |
| T3-01 | 3 | — | — |
| T3-02 | 3 | — | D-01, D-02, D-06 |
| T3-03 | 3 | — | D-16, D-17 |
