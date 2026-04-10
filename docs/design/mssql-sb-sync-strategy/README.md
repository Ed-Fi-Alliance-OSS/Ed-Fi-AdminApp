# MSSQL Support Strategy for SB Sync Process

## Problem Statement

The Starting Blocks (SB) Sync process in the Ed-Fi Admin App currently relies on **pgboss** (pg-boss), a PostgreSQL-based job queue system, for background job scheduling and processing. However, the Admin App also supports Microsoft SQL Server (MSSQL) as a database engine. Since pgboss requires PostgreSQL-specific features (schemas, LISTEN/NOTIFY, advisory locks), it cannot function with MSSQL, leaving MSSQL deployments without sync capabilities.

### Current Implementation Overview

**pgboss Usage in SB Sync:**
- **Job Scheduling**: Cron-based scheduling for periodic environment syncs (`SB_SYNC_CRON`)
- **Job Queuing**: Asynchronous job submission for environment and tenant syncs
- **Job Processing**: Worker pattern with retry logic and failure handling
- **Job Tracking**: Materialized view (`SbSyncQueue`) for UI visibility into job status
- **Singleton Jobs**: Prevents duplicate sync jobs for the same resource (`singletonKey`)

**Affected Components:**
- `packages/api/src/sb-sync/pg-boss.module.ts` - PgBoss initialization
- `packages/api/src/sb-sync/sb-sync.consumer.ts` - Job scheduling and workers
- `packages/api/src/sb-sync/sb-sync.controller.ts` - Job status queries
- `packages/api/src/sb-environments-global/sb-environments-global.controller.ts` - Environment sync triggers
- `packages/api/src/edfi-tenants-global/edfi-tenants-global.controller.ts` - Tenant sync triggers
- `packages/models-server/src/entities/sb-sync-queue.view.entity.ts` - Job queue view (queries pgboss schema)

### Current MSSQL Blockers

```typescript
// pg-boss.module.ts
if (appConfig.DB_ENGINE === 'mssql') {
  // mssql is not yet supported
  return null;
}

// sb-sync.consumer.ts  
if (config.DB_ENGINE === 'mssql') {
  // mssql is not yet supported
  return null;
}
```

## Proposed Solution: Database-Agnostic Job Queue Abstraction

### Architecture Strategy

Implement a **Job Queue Abstraction Layer** that provides a unified interface for job scheduling and processing, with database-specific implementations for PostgreSQL (pgboss) and MSSQL (custom table-based queue).

### Design Principles

1. **No UI Changes**: Maintain existing API contracts and response structures
2. **Minimal External Dependencies**: Primarily reuse existing TypeORM infrastructure. For MSSQL only, add a small, well-maintained library (`cron-parser`) for cron expression parsing to replicate pgboss scheduling behavior. PostgreSQL deployments continue using pgboss's built-in cron parsing.
3. **Preserve Architecture**: Keep the same worker/consumer patterns
4. **Feature Parity**: Both implementations support the same capabilities
5. **Transparent Migration**: Automatically select implementation based on `DB_ENGINE` config

---

## Detailed Design

### 1. Job Queue Abstraction Interface

Create a new abstraction layer that defines the contract for job queue operations:

**Location:** `packages/api/src/sb-sync/job-queue/job-queue.interface.ts`

```typescript
export interface IJobQueueService {
  // Lifecycle
  start(): Promise<void>;
  stop(options?: { graceful?: boolean; destroy?: boolean }): Promise<void>;
  
  // Job submission
  send<T = object>(
    queueName: string,
    data: T,
    options?: JobOptions
  ): Promise<string>; // Returns job ID
  
  // Scheduling (cron-based periodic jobs)
  schedule(
    queueName: string,
    cron: string,
    data: any,
    options?: ScheduleOptions
  ): Promise<void>;
  
  // Worker registration
  work<T = object>(
    queueName: string,
    handler: (job: Job<T>) => Promise<void>
  ): Promise<void>;
  
  // Job status queries
  getJobById(id: string): Promise<Job>;
}

export interface Job<T = object> {
  id: string;
  name: string;
  data: T;
  state: JobState;
  createdon: Date;
  startedon?: Date;
  completedon?: Date;
  output?: any;
  retrycount?: number;
}

export type JobState = 
  | 'created' 
  | 'retry' 
  | 'active' 
  | 'completed' 
  | 'expired' 
  | 'cancelled' 
  | 'failed';

export interface JobOptions {
  singletonKey?: string;      // Prevent duplicate jobs
  expireInHours?: number;      // Auto-expire uncompleted jobs
  retryLimit?: number;         // Max retry attempts
  retryDelay?: number;         // Delay between retries (ms)
  retryBackoff?: boolean;      // Exponential backoff
}

export interface ScheduleOptions {
  tz?: string;                 // Timezone for cron
}
```

---

### 2. PostgreSQL Implementation (pgboss wrapper)

**Location:** `packages/api/src/sb-sync/job-queue/pg-boss-adapter.service.ts`

This adapter wraps the existing pgboss implementation to conform to the `IJobQueueService` interface.

```typescript
@Injectable()
export class PgBossAdapter implements IJobQueueService, OnApplicationShutdown {
  private boss: PgBoss;
  
  // Constructor must remain synchronous - initialization happens in start()
  constructor(private readonly connectionString: string) {
    this.boss = new PgBoss({ connectionString: this.connectionString });
  }
  
  async start(): Promise<void> {
    await this.boss.start();
  }
  
  async stop(options?: { graceful?: boolean; destroy?: boolean }): Promise<void> {
    await this.boss.stop(options);
  }
  
  async send<T>(queueName: string, data: T, options?: JobOptions): Promise<string> {
    const id = await this.boss.send(queueName, data, options);
    // pg-boss v9 returns null when a singleton duplicate is silently deduped (D-14)
    if (id === null) {
      return options?.singletonKey ?? 'deduped';
    }
    return id;
  }
  
  async schedule(queueName: string, cron: string, data: any, options?: ScheduleOptions): Promise<void> {
    await this.boss.schedule(queueName, cron, data, options);
  }
  
  async work<T>(queueName: string, handler: (job: Job<T>) => Promise<void>): Promise<void> {
    await this.boss.work(queueName, handler);
  }
  
  async getJobById(id: string): Promise<Job> {
    return this.boss.getJobById(id);
  }
  
  async onApplicationShutdown() {
    await this.stop({ graceful: false, destroy: true });
  }
}
```

---

### 3. MSSQL Implementation (Table-Based Queue)

**Location:** `packages/api/src/sb-sync/job-queue/mssql-job-queue.service.ts`

This implementation uses TypeORM entities and a polling mechanism to simulate pgboss behavior on MSSQL.

> **📝 Note on Dependencies**: The MSSQL implementation uses `cron-parser` for parsing cron expressions (since we're building a custom scheduler from scratch). This dependency is **only loaded when `DB_ENGINE=mssql`**. PostgreSQL deployments continue using pgboss, which has built-in cron parsing and does not require this package.

**Location:** `packages/api/src/sb-sync/job-queue/mssql-job-queue.service.ts`

This implementation uses TypeORM entities and a polling mechanism to simulate pgboss behavior on MSSQL.

#### 3.1. Database Schema

**Entity:** `packages/models-server/src/entities/job-queue.entity.ts`

```typescript
// Note: The singletonKey filtered unique index is created via raw migration SQL (D-11).
// Do NOT use the @Index decorator for filtered/conditional indexes on MSSQL — TypeORM DDL
// generation for filtered WHERE clauses is unreliable across SQL Server versions.
@Entity('job_queue')
@Index(['name', 'state'])
export class JobQueue {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'nvarchar', length: 'MAX' })
  data: string; // JSON string

  @Column({
    type: 'varchar',
    length: 50,
    default: 'created'
  })
  state: JobState;

  @Column({ type: 'datetime2', nullable: true })
  createdon: Date;

  @Column({ type: 'datetime2', nullable: true })
  startedon: Date;

  @Column({ type: 'datetime2', nullable: true })
  completedon: Date;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  output: string; // JSON string

  @Column({ type: 'int', default: 0 })
  retrycount: number;

  @Column({ type: 'int', default: 3 })
  retrylimit: number;

  @Column({ type: 'int', nullable: true })
  retrydelay: number;

  @Column({ type: 'bit', default: false })
  retrybackoff: boolean;

  @Column({ type: 'datetime2', nullable: true })
  expirein: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  singletonKey: string;

  @Column({ type: 'datetime2', nullable: true })
  keepuntil: Date;

  // Enforces retry delay / backoff. processJobs() only claims rows where availableAt <= now. (D-06)
  @Column({ type: 'datetime2', nullable: true })
  availableAt: Date;

  // Lease expiry used for crash recovery. Stale 'active' rows with leaseUntil < now are
  // requeued by the startup sweeper before the polling loop begins. (D-02)
  @Column({ type: 'datetime2', nullable: true })
  leaseUntil: Date;
}

// JobSchedule entity is intentionally omitted for v1.
// Scheduling is handled in-process via cron-parser inside MssqlJobQueueService (D-10).
// A persistent job_schedule table may be added in Phase 4 if multi-schedule support is needed.
```

#### 3.2. Service Implementation

```typescript
import { parseExpression } from 'cron-parser'; // pinned to ^3.1.0 (D-13)

@Injectable()
export class MssqlJobQueueService implements IJobQueueService, OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MssqlJobQueueService.name);
  private workers: Map<string, (job: Job) => Promise<void>> = new Map();
  // In-process schedule registry — no DB table (D-10)
  private scheduleRegistry: Map<string, { cron: string; data: any; tz: string }> = new Map();
  private lastScheduleFire: Map<string, Date> = new Map();
  private pollingTimer: NodeJS.Timeout;
  private scheduleTimer: NodeJS.Timeout;
  private isRunning = false;
  private readonly pollIntervalMs: number;
  private readonly scheduleIntervalMs: number;

  constructor(
    @InjectRepository(JobQueue)
    private jobRepository: Repository<JobQueue>,
  ) {
    // Intervals are configurable via environment variables (D-16)
    this.pollIntervalMs = config.MSSQL_JOB_POLL_MS ?? 1000;
    this.scheduleIntervalMs = config.MSSQL_SCHEDULE_POLL_MS ?? 10000;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    // Recover stale 'active' jobs from any prior crash before polling begins (D-02)
    await this.recoverStaleJobs();
    this.runJobLoop();
    this.runScheduleLoop();
    this.logger.log('MSSQL Job Queue started');
  }

  async stop(options?: { graceful?: boolean }): Promise<void> {
    this.isRunning = false;
    if (this.pollingTimer) clearTimeout(this.pollingTimer);
    if (this.scheduleTimer) clearTimeout(this.scheduleTimer);

    if (options?.graceful) {
      const timeout = 30000;
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const activeCount = await this.jobRepository.count({ where: { state: 'active' } });
        if (activeCount === 0) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    this.logger.log('MSSQL Job Queue stopped');
  }

  async send<T>(queueName: string, data: T, options?: JobOptions): Promise<string> {
    const job = new JobQueue();
    job.id = randomUUID();
    job.name = queueName;
    job.data = JSON.stringify(data);
    job.state = 'created';
    job.createdon = new Date();
    job.singletonKey = options?.singletonKey;
    job.retrylimit = options?.retryLimit ?? 3;
    job.retrydelay = options?.retryDelay ?? 0;
    job.retrybackoff = options?.retryBackoff ?? false;

    if (options?.expireInHours) {
      job.expirein = new Date(Date.now() + options.expireInHours * 3600000);
    }

    try {
      await this.jobRepository.save(job);
      this.logger.log(`Job ${job.id} queued for ${queueName}`);
      return job.id;
    } catch (error) {
      if (error.code === '2601' || error.code === '2627') {
        this.logger.warn(`Duplicate job prevented for singleton key: ${options.singletonKey}`);
        // Constrain by active states to avoid returning a stale completed/failed row (D-08)
        const existing = await this.jobRepository.findOne({
          where: {
            singletonKey: options.singletonKey,
            state: In(['created', 'retry', 'active']),
          },
        });
        return existing?.id ?? job.id;
      }
      throw error;
    }
  }

  // Registers an in-process cron schedule — no DB persistence needed for v1 (D-10)
  async schedule(queueName: string, cron: string, data: any, options?: ScheduleOptions): Promise<void> {
    this.scheduleRegistry.set(queueName, { cron, data, tz: options?.tz ?? 'UTC' });
    this.logger.log(`Cron schedule registered in-process for queue: ${queueName} (${cron})`);
  }

  async work<T>(queueName: string, handler: (job: Job<T>) => Promise<void>): Promise<void> {
    this.workers.set(queueName, handler as any);
    this.logger.log(`Worker registered for queue: ${queueName}`);
  }

  async getJobById(id: string): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id } });
    if (!job) throw new NotFoundException(`Job ${id} not found`);

    return {
      id: job.id,
      name: job.name,
      data: JSON.parse(job.data),
      state: job.state,
      createdon: job.createdon,
      startedon: job.startedon,
      completedon: job.completedon,
      output: job.output ? JSON.parse(job.output) : undefined,
      retrycount: job.retrycount,
    };
  }

  // ---- Private methods ----

  // Guarded loop — next tick only starts after the current one finishes (D-09)
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

  // Guarded loop — prevents overlapping schedule checks (D-09)
  private async runScheduleLoop(): Promise<void> {
    if (!this.isRunning) return;
    try {
      await this.processSchedules();
    } finally {
      if (this.isRunning) {
        this.scheduleTimer = setTimeout(() => this.runScheduleLoop(), this.scheduleIntervalMs);
      }
    }
  }

  // Atomically claim up to 10 eligible jobs using MSSQL locking hints (D-01)
  private async processJobs(): Promise<void> {
    if (!this.isRunning) return;

    const leaseUntil = new Date(Date.now() + 5 * 60 * 1000); // 5-minute lease (D-02)

    const claimed: JobQueue[] = await this.jobRepository.query(`
      UPDATE TOP (10) job_queue WITH (UPDLOCK, ROWLOCK, READPAST)
      SET state     = 'active',
          startedon  = GETUTCDATE(),
          leaseUntil = @0
      OUTPUT INSERTED.*
      WHERE state IN ('created', 'retry')
        AND (availableAt IS NULL OR availableAt <= GETUTCDATE())
        AND (expirein    IS NULL OR expirein    >  GETUTCDATE())
    `, [leaseUntil]);

    for (const job of claimed) {
      // fire-and-forget — each job runs independently without blocking the next poll tick
      void this.executeJob(job);
    }
  }

  private async executeJob(job: JobQueue): Promise<void> {
    const handler = this.workers.get(job.name);
    if (!handler) {
      this.logger.warn(`No worker registered for queue: ${job.name}`);
      return;
    }

    try {
      const jobData: Job = {
        id: job.id,
        name: job.name,
        data: JSON.parse(job.data),
        state: 'active',
        createdon: job.createdon,
        startedon: job.startedon ?? new Date(),
        completedon: job.completedon,
        output: job.output ? JSON.parse(job.output) : undefined,
        retrycount: job.retrycount,
      };

      await handler(jobData);

      await this.jobRepository.update(job.id, {
        state: 'completed',
        completedon: new Date()
      });

      this.logger.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);

      if (job.retrycount < job.retrylimit) {
        const nextRetryMs = job.retrybackoff
          ? Math.pow(2, job.retrycount) * (job.retrydelay || 1000)
          : job.retrydelay || 1000;

        await this.jobRepository.update(job.id, {
          state: 'retry',
          retrycount: job.retrycount + 1,
          availableAt: new Date(Date.now() + nextRetryMs), // persist delay so poll respects it (D-06)
          output: JSON.stringify({ error: error.message, stack: error.stack }),
        });

        this.logger.log(`Job ${job.id} will retry in ${nextRetryMs}ms`);
      } else {
        await this.jobRepository.update(job.id, {
          state: 'failed',
          completedon: new Date(),
          output: JSON.stringify({ error: error.message, stack: error.stack }),
        });
      }
    }
  }

  // In-process cron scheduler; reads registry populated by schedule() (D-10)
  // Uses sp_getapplock to prevent multi-instance duplicate fires (D-07)
  private async processSchedules(): Promise<void> {
    if (!this.isRunning || this.scheduleRegistry.size === 0) return;

    const now = new Date();

    for (const [queueName, entry] of this.scheduleRegistry.entries()) {
      const lastFire = this.lastScheduleFire.get(queueName);
      const nextFire = lastFire
        ? this.calculateNextRun(entry.cron, entry.tz, lastFire)
        : new Date(0); // fire immediately on first tick if no prior record

      if (nextFire <= now) {
        const acquired = await this.tryAcquireSchedulerLock(queueName);
        if (acquired) {
          try {
            await this.send(queueName, entry.data ?? null);
            this.lastScheduleFire.set(queueName, now);
          } finally {
            await this.releaseSchedulerLock(queueName);
          }
        }
      }
    }
  }

  private calculateNextRun(cron: string, timezone?: string, fromDate?: Date): Date {
    const interval = parseExpression(cron, {
      currentDate: fromDate ?? new Date(),
      tz: timezone ?? 'UTC',
    });
    return interval.next().toDate();
  }

  // Startup sweeper: requeue any 'active' jobs whose lease expired (crash recovery) (D-02)
  private async recoverStaleJobs(): Promise<void> {
    const result = await this.jobRepository.query(`
      UPDATE job_queue
      SET state = 'retry', retrycount = retrycount + 1
      WHERE state = 'active' AND leaseUntil < GETUTCDATE()
    `);
    const recovered = result?.rowsAffected ?? 0;
    if (recovered > 0) {
      this.logger.warn(`Recovered ${recovered} stale active job(s) on startup`);
    }
  }

  // Advisory lock via sp_getapplock — ensures only one instance fires a given schedule (D-07)
  private async tryAcquireSchedulerLock(name: string): Promise<boolean> {
    const [result] = await this.jobRepository.query(
      `EXEC sp_getapplock @Resource = @0, @LockMode = 'Exclusive', @LockOwner = 'Session', @LockTimeout = 0`,
      [`scheduler_${name}`]
    );
    return (result?.returnCode ?? -1) >= 0;
  }

  private async releaseSchedulerLock(name: string): Promise<void> {
    await this.jobRepository.query(
      `EXEC sp_releaseapplock @Resource = @0, @LockOwner = 'Session'`,
      [`scheduler_${name}`]
    );
  }

  async onApplicationBootstrap() {
    await this.start();
  }

  async onApplicationShutdown() {
    await this.stop({ graceful: true });
  }
}
```

---

### 4. Factory Pattern for Implementation Selection

**Location:** `packages/api/src/sb-sync/job-queue/job-queue.module.ts`

```typescript
@Global()
@Module({
  // Only register MSSQL repositories when running on MSSQL; avoids TypeORM metadata
  // validation errors on PostgreSQL where these tables do not exist (D-12)
  imports: [
    ...(config.DB_ENGINE === 'mssql'
      ? [TypeOrmModule.forFeature([JobQueue])]
      : []),
  ],
  providers: [
    {
      provide: 'IJobQueueService',
      useFactory: async (jobRepo?: Repository<JobQueue>) => {
        if (config.DB_ENGINE === 'mssql') {
          return new MssqlJobQueueService(jobRepo);
        } else {
          const connectionString = await config.DB_CONNECTION_STRING;
          return new PgBossAdapter(connectionString);
        }
      },
      inject: [
        ...(config.DB_ENGINE === 'mssql' ? [getRepositoryToken(JobQueue)] : []),
      ],
    },
  ],
  exports: ['IJobQueueService'],
})
export class JobQueueModule {}
```

---

### 5. Update SbSyncQueue View for MSSQL

The `SbSyncQueue` materialized view currently queries the `pgboss.job` and `pgboss.archive` tables. For MSSQL, it should query the `job_queue` table instead.

> **⚠️ Entity change required (D-03, D-05):** The existing `sb-sync-queue.view.entity.ts` uses
> `@ViewEntity({ expression: ... })` with PostgreSQL-specific syntax. This must be changed to a
> plain `@Entity('sb_sync_queue')` so TypeORM treats it as a regular table-like entity on **both**
> engines. The engine-specific view SQL is created entirely within migrations — TypeORM itself
> does not generate it.
>
> The current MSSQL migration (`1709328882890-v7-changes.ts`) creates a **dummy** `sb_sync_queue`
> view that returns no rows. A new MSSQL migration must drop this placeholder and create the real
> view below.
>
> **Deserialization:** On MSSQL, `data` and `output` are stored as `nvarchar(max)`. Parse them
> to objects in the DTO mapping layer (`toSbSyncQueueDto`) using `JSON.parse()` rather than in
> the entity itself.

**Approach:** Use conditional view definitions in migrations.

**PostgreSQL View (unchanged):**
```sql
CREATE MATERIALIZED VIEW sb_sync_queue AS
WITH job AS (
  SELECT id, name, data, state, createdon, completedon, output
  FROM pgboss.job
  WHERE name IN ('sbe-sync', 'edfi-tenant-sync')
  UNION
  SELECT id, name, data, state, createdon, completedon, output
  FROM pgboss.archive
  WHERE name IN ('sbe-sync', 'edfi-tenant-sync')
)
SELECT 
  job.id,
  CASE WHEN job.name = 'sbe-sync' THEN 'SbEnvironment' ELSE 'EdfiTenant' END AS type,
  COALESCE(sb_environment.name, edfi_tenant.name, 'resource no longer exists') AS name,
  COALESCE(sb_environment.id, edfi_tenant.sbEnvironmentId) AS sbEnvironmentId,
  edfi_tenant.id AS edfiTenantId,
  data::text AS dataText,
  data,
  state,
  createdon,
  completedon,
  output,
  (job.output -> 'hasChanges')::bool AS hasChanges
FROM job
LEFT JOIN public.sb_environment ON (job.data -> 'sbEnvironmentId')::int = sb_environment.id
LEFT JOIN public.edfi_tenant ON (job.data -> 'edfiTenantId')::int = edfi_tenant.id;
```

**MSSQL View:**
```sql
CREATE VIEW sb_sync_queue AS
SELECT 
  jq.id,
  CASE WHEN jq.name = 'sbe-sync' THEN 'SbEnvironment' ELSE 'EdfiTenant' END AS type,
  COALESCE(sbe.name, et.name, 'resource no longer exists') AS name,
  COALESCE(sbe.id, et.sbEnvironmentId) AS sbEnvironmentId,
  et.id AS edfiTenantId,
  jq.data AS dataText,
  jq.data,
  jq.state,
  jq.createdon,
  jq.completedon,
  jq.output,
  CASE WHEN JSON_VALUE(jq.output, '$.hasChanges') = 'true' THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS hasChanges
FROM job_queue jq
LEFT JOIN sb_environment sbe ON JSON_VALUE(jq.data, '$.sbEnvironmentId') = CAST(sbe.id AS NVARCHAR)
LEFT JOIN edfi_tenant et ON JSON_VALUE(jq.data, '$.edfiTenantId') = CAST(et.id AS NVARCHAR)
WHERE jq.name IN ('sbe-sync', 'edfi-tenant-sync');
```

**Note:** MSSQL views cannot be materialized. The view will be a regular view, which should perform adequately given the expected job volume.

---

### 6. Update Consumer to Use Abstraction

**Location:** `packages/api/src/sb-sync/sb-sync.consumer.ts`

```typescript
@Injectable()
export class SbSyncConsumer implements OnModuleInit {
  constructor(
    @InjectRepository(SbEnvironment)
    private sbEnvironmentsRepository: Repository<SbEnvironment>,
    @InjectRepository(EdfiTenant)
    private edfiTenantsRepository: Repository<EdfiTenant>,
    @Inject('IJobQueueService')
    private readonly jobQueue: IJobQueueService,  // Changed from PgBossInstance
    private readonly sbServiceV1: StartingBlocksServiceV1,
    private readonly sbServiceV2: StartingBlocksServiceV2,
    private readonly metadataService: MetadataService,
    private readonly adminapiSyncService: AdminApiSyncService
  ) {}
  
  public async onModuleDestroy() {
    await this.jobQueue.stop();
  }
  
  public async onModuleInit() {
    try {
      await this.jobQueue.schedule(SYNC_SCHEDULER_CHNL, config.SB_SYNC_CRON, null, {
        tz: 'America/Chicago',
      });
      Logger.log('Sync scheduler job scheduled successfully');
    } catch (error) {
      Logger.error('Failed to schedule sync job:', error);
      throw error;
    }

    try {
      await this.jobQueue.work(SYNC_SCHEDULER_CHNL, async () => {
        // ⚠️ PostgreSQL-only JSON operator — must be replaced with a cross-engine helper (D-04)
        // Use jsonValue() from packages/api/src/utils/db-json-query.ts:
        //   PostgreSQL: `"configPublic"->>'sbEnvironmentMetaArn' is not null`
        //   MSSQL:      `JSON_VALUE(configPublic, '$.sbEnvironmentMetaArn') IS NOT NULL`
        // Replace with: .where(`${jsonValue('configPublic', 'sbEnvironmentMetaArn', config.DB_ENGINE)} IS NOT NULL`)
        const sbEnvironments = await this.sbEnvironmentsRepository
          .createQueryBuilder()
          .select()
          .where(`"configPublic"->>'sbEnvironmentMetaArn' is not null`)
          .getMany();

        Logger.log(`Starting sync for ${sbEnvironments.length} environments.`);
        await Promise.all(
          sbEnvironments.map((sbEnvironment) =>
            this.jobQueue.send(
              ENV_SYNC_CHNL,
              { sbEnvironmentId: sbEnvironment.id },
              { singletonKey: String(sbEnvironment.id), expireInHours: 1 }
            )
          )
        );
      });

      await this.jobQueue.work(ENV_SYNC_CHNL, async (job: Job<{ sbEnvironmentId: number }>) => {
        return this.refreshSbEnvironment(job.data.sbEnvironmentId);
      });

      await this.jobQueue.work(TENANT_SYNC_CHNL, async (job: Job<{ edfiTenantId: number }>) => {
        return this.refreshEdfiTenant(job.data.edfiTenantId);
      });

      Logger.log('Sync workers registered successfully');
    } catch (error) {
      Logger.error('Failed to register sync workers:', error);
      throw error;
    }
  }
  
  // ... rest of implementation unchanged
}
```

---

### 7. Update Controllers to Use Abstraction

**Location:** `packages/api/src/sb-environments-global/sb-environments-global.controller.ts`

```typescript
@ApiTags('SbEnvironment - Global')
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor)
@Controller()
export class SbEnvironmentsGlobalController {
  constructor(
    @InjectRepository(SbEnvironment)
    private readonly sbEnvironmentRepository: Repository<SbEnvironment>,
    @Inject('IJobQueueService')
    private readonly jobQueue: IJobQueueService,  // Changed from PgBossInstance
    @InjectRepository(SbSyncQueue) 
    private readonly queueRepository: Repository<SbSyncQueue>,
    private readonly sbEnvironmentEdFiService: SbEnvironmentEdFiService
  ) {}
  
  @Post(':sbEnvironmentId/refresh')
  @Authorize({ includeResourceOnContext: true, withPrivilege: 'sbEnvironment:write' })
  async refreshResources(@Param('sbEnvironmentId', new ParseIntPipe()) sbEnvironmentId: number) {
    const id = await this.jobQueue.send(  // Changed from this.boss.send
      ENV_SYNC_CHNL,
      { sbEnvironmentId: sbEnvironmentId },
      { expireInHours: 2 }
    );
    const repo = this.queueRepository;
    return new Promise((r) => {
      let queueItem: SbSyncQueue;
      const timer = setInterval(poll, 500);
      const pendingState: PgBossJobState[] = ['created', 'retry', 'active'];
      let i = 0;
      async function poll() {
        queueItem = await repo.findOneBy({ id });
        if (i === 20 || !pendingState.includes(queueItem.state)) {
          clearInterval(timer);
          r(toSbSyncQueueDto(queueItem));
        }
        i++;
      }
    });
  }
}
```

Similar changes apply to:
- `packages/api/src/edfi-tenants-global/edfi-tenants-global.controller.ts`
- `packages/api/src/sb-sync/sb-sync.controller.ts`

---

## Implementation Checklist

### Phase 1: Abstraction Layer (No Breaking Changes)

- [ ] Create `IJobQueueService` interface in `job-queue.interface.ts`
- [ ] Implement `PgBossAdapter` wrapping existing pgboss functionality
  - [ ] Handle `null` return from `boss.send()` for singleton deduplication (D-14)
- [ ] Create `JobQueueModule` with engine-conditional factory and `TypeOrmModule.forFeature` (D-12)
- [ ] Update `SbSyncConsumer` to inject `IJobQueueService` instead of pgboss directly
- [ ] Update controllers to inject `IJobQueueService`
  - [ ] Fix `triggerSync()` call signature and remove pgboss-internal field access (D-15)
- [ ] **Test thoroughly on PostgreSQL** — ensure no regression
- [ ] Run all existing unit and integration tests
- [ ] Verify sync functionality in dev/staging environments

### Phase 2: MSSQL Implementation

- [ ] Create `JobQueue` entity with `availableAt` and `leaseUntil` columns (D-02, D-06)
  - Remove `@Index` decorator for `singletonKey`; create filtered index via migration SQL (D-11)
  - No `JobSchedule` entity — scheduling is in-process for v1 (D-10)
- [ ] Pin `cron-parser@^3.1.0`; use top-level named import (D-13)
- [ ] Implement `MssqlJobQueueService`:
  - [ ] Startup sweeper to recover stale `active` jobs on `onApplicationBootstrap` (D-02)
  - [ ] Atomic job claim using `UPDATE TOP(10) ... WITH (UPDLOCK, ROWLOCK, READPAST) OUTPUT INSERTED.*` (D-01)
  - [ ] Guarded `setTimeout` polling loop — no overlapping ticks (D-09)
  - [ ] Persist `availableAt` on retry so delay is actually enforced (D-06)
  - [ ] In-process cron schedule registry in `schedule()` — no DB table (D-10)
  - [ ] `sp_getapplock` leader guard in `processSchedules()` (D-07)
  - [ ] Fix singleton fallback to constrain by active states (D-08)
  - [ ] Configurable poll intervals via `MSSQL_JOB_POLL_MS` / `MSSQL_SCHEDULE_POLL_MS` (D-16)
- [ ] Create cross-engine JSON query helper `packages/api/src/utils/db-json-query.ts` (D-04)
  - [ ] Replace all PostgreSQL-only JSON operators in `sb-sync.consumer.ts`
- [ ] Fix `SbSyncQueue` entity: replace `@ViewEntity(expression)` with plain `@Entity` (D-03)
- [ ] Generate new MSSQL migration:
  - [ ] Create `job_queue` table
  - [ ] Create filtered unique index `UX_job_queue_singletonKey_active` via raw SQL (D-11)
  - [ ] Drop dummy `sb_sync_queue` view; create real MSSQL view (D-05)
- [ ] Write unit tests for `MssqlJobQueueService`:
  - [ ] Atomic claim — verify no duplicate execution under concurrent poll
  - [ ] Singleton key enforcement (D-08)
  - [ ] Retry delay enforcement via `availableAt` (D-06)
  - [ ] Expiration handling
  - [ ] Crash-recovery sweeper (D-02)
  - [ ] In-process cron scheduling
- [ ] Test MSSQL implementation in isolated environment
- [ ] Load test to validate performance (100+ jobs)

### Phase 3: Integration & Validation

- [ ] Update documentation (this file and `sb-sync-functionality.md`)
- [ ] Create deployment guide for MSSQL users
- [ ] Run end-to-end tests with MSSQL database
- [ ] Verify UI displays job status correctly on MSSQL
- [ ] **Concurrency validation:** confirm atomic claim prevents duplicate job execution (D-01)
- [ ] **Crash-recovery validation:** simulate process kill mid-job; verify sweeper requeues on restart (D-02)
- [ ] **Retry delay validation:** confirm `availableAt` is respected and backoff is enforced (D-06)
- [ ] PostgreSQL regression tests — all existing sync tests pass unchanged
- [ ] Performance comparison between pgboss and MSSQL implementation (informational, not a gate)
- [ ] Document MSSQL scheduling jitter (up to `MSSQL_SCHEDULE_POLL_MS`, default 10 s) (D-16)
- [ ] Final code review and security scan
- [ ] Update configuration docs for `DB_ENGINE`, `MSSQL_JOB_POLL_MS`, `MSSQL_SCHEDULE_POLL_MS`

---

## Migration Path

### For Existing PostgreSQL Deployments

**No changes required.** The abstraction layer ensures backward compatibility. Existing pgboss tables and data remain untouched.

### For New or Existing MSSQL Deployments

1. Set `DB_ENGINE=mssql` in configuration
2. Run database migrations: `npm run migrations:run`
3. Migrations will create `job_queue` and `job_schedule` tables
4. Migrations will create MSSQL-compatible `sb_sync_queue` view
5. Application automatically uses MSSQL implementation on startup

---

## Performance Considerations

### PostgreSQL (pgboss)

- **Strengths:**
  - Built-in LISTEN/NOTIFY for instant job notifications
  - Advisory locks prevent race conditions
  - Mature, battle-tested library
  - Optimized for high throughput
  
- **Limitations:**
  - Requires PostgreSQL-specific features
  - Additional schema (`pgboss`)

### MSSQL (Table-Based Queue)

- **Strengths:**
  - Works with MSSQL without external dependencies
  - Predictable behavior
  - Easy to debug (standard SQL queries)
  
- **Limitations:**
  - Polling introduces 1-second latency (configurable)
  - Higher database load due to polling queries
  - View instead of materialized view (slightly slower reads)
  
- **Optimization Strategies:**
  - Use composite indexes on `(name, state)` for fast job queries
  - Unique index on `singletonKey` prevents duplicate jobs
  - Archive completed jobs after 7 days to keep table small
  - Polling interval can be tuned based on load (500ms-5s)

### Expected Performance

For typical Admin App deployments:
- **Job Volume:** 10-50 sync jobs per hour (scheduled + on-demand)
- **Concurrent Workers:** 3 queues (scheduler, environment, tenant)
- **Latency Impact:** MSSQL polling adds ~1 second average delay
- **Database Impact:** ~60 queries/minute for polling (negligible)

**Verdict:** MSSQL implementation is suitable for Admin App's job volume. For high-throughput scenarios (>1000 jobs/hour), consider moving to PostgreSQL or an external queue service (Redis, SQS).

---

## Alternative Approaches Considered

### 1. External Queue Service (Redis, AWS SQS, Azure Service Bus)

**Pros:**
- Database-agnostic
- Highly scalable
- Purpose-built for job queuing

**Cons:**
- ❌ Requires new infrastructure component
- ❌ Additional operational complexity
- ❌ Violates "no new external dependencies" constraint
- ❌ Breaking change for existing deployments

### 2. BullMQ (Redis-based)

**Pros:**
- Feature-rich (retries, priorities, rate limiting)
- Active community
- Works with any database

**Cons:**
- ❌ Requires Redis instance
- ❌ Additional dependency and configuration
- ❌ Overkill for Admin App's job volume

### 3. TypeORM-based Custom Queue (with SELECT FOR UPDATE)

**Pros:**
- No external dependencies
- Database-agnostic (works on both engines)

**Cons:**
- More complex locking implementation
- `SELECT FOR UPDATE` semantics differ between engines
- Requires careful concurrency handling

### 4. In-Memory Queue (node-schedule or cron)

**Pros:**
- No database storage
- Lightweight

**Cons:**
- ❌ Jobs lost on application restart
- ❌ No job history/tracking
- ❌ No visibility in UI
- ❌ Cannot scale horizontally

---

## Risk Assessment

### Low Risk

- **Abstraction Layer:** Wraps existing functionality without changes
- **PostgreSQL Path:** Zero-impact change (adapter pattern)
- **Isolated Implementation:** MSSQL code path is completely separate

### Medium Risk

- **Polling Performance:** MSSQL polling may increase database load
  - **Mitigation:** Tune polling interval, add indexes, archive old jobs
- **View vs Materialized View:** MSSQL `SbSyncQueue` view may be slower
  - **Mitigation:** Add indexes on underlying `job_queue` table

### High Risk (Mitigated)

- **Job Loss:** Polling mechanism missing jobs due to race conditions
  - **Mitigation:** Unique indexes, transaction isolation, retry logic
- **Singleton Enforcement:** Duplicate jobs bypassing singleton key
  - **Mitigation:** Unique constraint on `singletonKey` column

---

## Testing Strategy

### Unit Tests

- [ ] `IJobQueueService` interface compliance tests for both implementations
- [ ] Job submission with various options (singleton, expiry, retry)
- [ ] Retry logic with exponential backoff
- [ ] Cron parsing and next run calculation
- [ ] Job state transitions (created → active → completed/failed)

### Integration Tests

- [ ] End-to-end sync flow on PostgreSQL
- [ ] End-to-end sync flow on MSSQL
- [ ] Concurrent job execution (prevent race conditions)
- [ ] Scheduled job triggering at correct times
- [ ] Singleton key enforcement (duplicate prevention)

### Performance Tests

- [ ] Baseline: Current pgboss performance on PostgreSQL
- [ ] MSSQL implementation with 100 concurrent jobs
- [ ] Polling overhead measurement (CPU, DB queries)
- [ ] View query performance (`SbSyncQueue` read latency)

### Regression Tests

- [ ] Existing SB Sync tests pass on PostgreSQL
- [ ] UI displays job status correctly on both engines
- [ ] Manual triggering of sync works on both engines
- [ ] Scheduled sync executes on both engines

---

## Success Criteria

1. ✅ **Feature Parity:** MSSQL supports all sync operations (scheduled, manual, tenant, environment)
2. ✅ **No Breaking Changes:** Existing PostgreSQL deployments work without modification
3. ✅ **No UI Changes:** Frontend code remains identical
4. ✅ **Minimal New Dependencies:** One small cron-parsing library (`cron-parser@^3.1.0`) added for the MSSQL path only; no new infrastructure services required (D-17)
5. ✅ **Performance:** MSSQL sync completes within 2x PostgreSQL time (acceptable tradeoff)
6. ✅ **Reliability:** Zero data loss, proper retry handling, transaction safety
7. ✅ **Maintainability:** Clear abstraction, well-documented, testable

---

## Post-Implementation Monitoring

### Metrics to Track

1. **Job Latency:** Time from creation to execution (PostgreSQL vs MSSQL)
2. **Failure Rate:** Percentage of jobs that fail after all retries
3. **Database Load:** Query count and CPU usage during sync operations
4. **Job Queue Size:** Number of pending jobs (detect backlog)

### Alerts

- Job queue exceeds 50 pending items (possible backlog)
- Job failure rate exceeds 10%
- Job latency exceeds 5 minutes
- Polling loop crashes or stops

---

## Future Enhancements

### Phase 4: Optimization (Post-Launch)

- [ ] Add job priorities (high-priority manually triggered syncs)
- [ ] Implement job batching (process multiple environments in parallel)
- [ ] Add job result caching (skip sync if no changes detected)
- [ ] Archive old jobs to separate table (keep views fast)
- [ ] Add admin dashboard for job queue monitoring

### Phase 5: Scalability (If Needed)

- [ ] Support horizontal scaling (multiple app instances)
  - Use database locks to coordinate job execution
  - Add `processedBy` column to track which instance processed job
- [ ] Move to external queue service for high-volume deployments (optional)

---

## Conclusion

This strategy provides a **clean, maintainable, and zero-breaking-change** path to enabling SB Sync functionality for MSSQL deployments. By introducing a job queue abstraction layer, we preserve the existing PostgreSQL implementation while adding a custom table-based queue for MSSQL.

### Key Benefits

- ✅ **Maintains Architecture:** No changes to worker/consumer patterns
- ✅ **Zero UI Impact:** Same API contracts and response structures
- ✅ **No New Infrastructure:** Leverages existing TypeORM and database
- ✅ **Transparent Selection:** Automatic based on `DB_ENGINE` config
- ✅ **Testable Design:** Clear interfaces and dependency injection
- ✅ **Future-Proof:** Abstraction allows swapping implementations later

### Recommended Timeline

- **Phase 1 (Abstraction):** 1-2 weeks
- **Phase 2 (MSSQL Implementation):** 2-3 weeks
- **Phase 3 (Testing & Validation):** 1-2 weeks
- **Total:** 4-7 weeks

### Next Steps

1. Review and approve this design document
2. Create implementation tickets for each phase
3. Begin Phase 1 (abstraction layer) with PostgreSQL testing
4. Implement Phase 2 (MSSQL) in parallel feature branch
5. Comprehensive testing before merge to main

---
