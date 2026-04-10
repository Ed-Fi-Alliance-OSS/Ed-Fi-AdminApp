# Findings: `docs\design\mssql-sb-sync-strategy.md` (GPT5.4)

## Overall assessment

**Verdict: approve with revisions, not as-is.**

The document is directionally aligned with the goal:

- **No external service dependency**
- **MSSQL-backed background processing**
- **Low dependency count**
- **Preserve the existing SB Sync flow and UI contract**

That said, the current proposal is still **too optimistic on correctness** and **too broad for a first implementation**. In its current form, it is not yet a safe pg_boss-like substitute for MSSQL.

## What the document gets right

1. A database-backed queue is the right direction if we want pg_boss-like behavior without Redis, SQS, Service Bus, or another external service.
2. Wrapping PostgreSQL behind an abstraction is a reasonable migration path and should reduce regression risk for existing pg_boss deployments.
3. Replacing the current MSSQL placeholder `sb_sync_queue` behavior is necessary. Today MSSQL has a dummy view and hard stop logic in the sync path instead of real support.

## Major gaps

### 1. The MSSQL worker design is not concurrency-safe yet

The proposed `MssqlJobQueueService` polls rows with a normal `find()` and then updates them to `active` later. That is **not enough** for a real queue.

**Why this is a problem**

- Two app instances can pick the same row.
- Two overlapping polling loops in the same instance can pick the same row.
- Scheduled work can also double-fire for the same reason.

**What is missing**

- Atomic claim/dequeue semantics in MSSQL
- Locking strategy such as `UPDLOCK`, `READPAST`, `ROWLOCK`, and `OUTPUT INSERTED.*`
- Clear single-instance vs multi-instance behavior

**Recommendation**

Use a real claim statement in raw MSSQL SQL, for example an `UPDATE TOP (...) ... OUTPUT INSERTED.*` pattern, instead of `find()` followed by `update()`.

### 2. Crash recovery and stuck-job recovery are missing

pg_boss-like behavior requires durable recovery when a process dies after claiming a job.

**What is missing**

- A lease field such as `leaseUntil` / `lockedUntil`
- Requeue logic for stale `active` jobs
- A startup reconciliation/sweeper
- Clear delivery semantics

Without that, a job can remain `active` forever after a crash.

### 3. Retry/backoff is incomplete in the proposed code

The document computes `nextRetry`, but the sample service never stores a future availability time and `processJobs()` still selects rows in `retry` immediately.

**Effect**

- Backoff is not actually enforced
- Retries happen on the next poll instead of after the intended delay

**What is missing**

- `availableAt` / `retryAfter`
- Selection rule: only claim rows where `availableAt <= now`
- Clear terminal failure behavior

### 4. The scheduling subsystem is over-scoped for v1

The design adds a generic `job_schedule` table and a generic schedule API. That is probably more than this repo needs right now.

**Current reality**

The existing sync path appears to have one recurring schedule driven by `config.SB_SYNC_CRON` in `packages\api\src\sb-sync\sb-sync.consumer.ts`.

**Recommendation**

For v1, prefer:

- One durable `job_queue` table
- One small cron library
- An in-process scheduler that only enqueues the existing sync scheduler job
- Leadership protection for the scheduler, ideally with `sp_getapplock`

That gives the repo the minimum viable pg_boss-like behavior with less schema and less code.

### 5. The document understates non-queue MSSQL blockers in the current code

This is the biggest scope gap I found against the real codebase.

The document treats the problem mostly as a queue replacement, but the current SB sync flow also contains **PostgreSQL-specific JSON query syntax** in `packages\api\src\sb-sync\sb-sync.consumer.ts`, for example:

- `"configPublic"->>'sbEnvironmentMetaArn'`
- `"configPublic"->>'adminApiUrl'`

Those queries will not run on MSSQL even after a queue is implemented.

**Implication**

The document should explicitly include:

- engine-safe JSON filtering for the sync consumer
- any required repository/query abstraction for JSON field access

Otherwise Phase 2 will still not deliver working MSSQL sync.

### 6. The `SbSyncQueue` mapping/migration story is incomplete

The design proposes a new MSSQL view, but the current repo has more baggage than the document acknowledges:

- `packages\models-server\src\entities\sb-sync-queue.view.entity.ts` is PostgreSQL-shaped and materialized-view-shaped
- `packages\api\src\database\migrations\mssql\1709328882890-v7-changes.ts` currently creates a **dummy** `sb_sync_queue` view that returns no rows
- TypeORM metadata for MSSQL currently fakes this as a `MATERIALIZED_VIEW`

**What is missing**

- Exact strategy for replacing the placeholder MSSQL view
- Whether the entity stays shared or becomes engine-specific
- How `data` and `output` will be shaped for MSSQL

Important detail: in PostgreSQL the view exposes JSON-like values naturally; in MSSQL the proposed `jq.data` / `jq.output` are still `nvarchar(max)`. The document does not explain how the API keeps returning object-shaped `data` and `output` consistently.

### 7. The proposed scheduler bootstrap is not idempotent

The sample MSSQL implementation inserts a new schedule row in `schedule()` every time the app boots.

**Risk**

- Duplicate schedules after restarts
- Duplicate schedules across multiple app instances

**What is missing**

- Unique key for schedules
- Upsert/merge behavior
- Or removal of the persisted schedule table entirely for v1

### 8. The singleton-key example is not fully correct

The proposed unique index on `singletonKey` is directionally right, but the sample fallback query after unique-constraint failure fetches by `singletonKey` alone and does not constrain state.

**Risk**

- Returning an older completed/failed row instead of the active one

If singleton behavior stays, the lookup should align with the filtered uniqueness rule.

### 9. Polling implementation details need tightening

The sample uses `setInterval(() => this.processJobs(), 1000)` and `setInterval(() => this.processSchedules(), 60000)`.

**Risks**

- Overlapping executions when work runs longer than the interval
- Scheduler drift
- Hard-to-debug duplicate claiming

**Recommendation**

Use a guarded loop or recursive `setTimeout` so only one poll cycle is active at a time.

## Dependency count vs stated goals

The document is mostly aligned with the “minimum one library or two” expectation, but it should be more explicit.

Right now it says both:

- minimal/no new dependencies
- add `cron-parser`

That is fine if stated clearly as:

> We will add at most one small scheduler dependency for MSSQL support and no new external infrastructure.

## Phase review

### Phase 1: Abstraction Layer

**Mostly good**, but probably too generic for a first pass.

If the queue abstraction stays, keep it narrow and scoped to what the app really uses:

- send
- work
- get job by id
- scheduler bootstrap for the one recurring sync trigger

Avoid designing a general-purpose queue platform unless that is an intentional product goal.

### Phase 2: MSSQL Implementation

**Needs the most revision.**

This phase should explicitly include:

1. atomic claim SQL
2. `availableAt`
3. `leaseUntil`
4. stale-job recovery
5. engine-safe JSON queries in the sync consumer
6. real `sb_sync_queue` mapping strategy

Without those, Phase 2 is incomplete.

### Phase 3: Integration & Validation

**Valid, but some items are not good release gates.**

Good gates:

- end-to-end MSSQL sync
- UI queue visibility
- regression protection for PostgreSQL

Less important for the first ship:

- performance comparison as a hard gate
- future optimization work

## Recommended alternative

If the main goal is “something similar to pg_boss in MSSQL” with **no other service dependency** and **at most one or two libraries**, I recommend a **narrower v1**:

### Keep

- PostgreSQL path on pg_boss
- An abstraction boundary
- A durable MSSQL queue table
- Existing controller and consumer behavior

### Simplify

- **Do not add a generic `job_schedule` table yet**
- Use **one small cron library** to enqueue `SYNC_SCHEDULER_CHNL`
- Use `sp_getapplock` or similar leadership control for the scheduler
- Use atomic row claiming for jobs
- Add `availableAt` and `leaseUntil`
- Add stale-job recovery

This is smaller, safer, and still meets the functional goal.

## Bottom line

The document has the **right high-level direction**, but it should not be implemented exactly as written.

### Must-fix before approval

1. Define atomic MSSQL claim/dequeue semantics
2. Add lease-based recovery for crashed/stuck jobs
3. Persist retry timing with `availableAt`
4. Make scheduling idempotent and leader-safe
5. Cover the existing PostgreSQL-only JSON queries in `sb-sync.consumer.ts`
6. Define the real MSSQL `sb_sync_queue` entity/migration/data-shape strategy
7. Reduce v1 scope to the minimum required behavior

If those revisions are made, the design will be much closer to the expectation: **a simple, in-app, MSSQL-backed pg_boss substitute with no external service dependency and only minimal library additions**.
