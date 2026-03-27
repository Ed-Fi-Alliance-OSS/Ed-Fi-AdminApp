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
    return this.boss.send(queueName, data, options);
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
@Entity('job_queue')
@Index(['name', 'state'])
@Index(['singletonKey'], { unique: true, where: "[singletonKey] IS NOT NULL AND [state] IN ('created', 'retry', 'active')" })
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
}

@Entity('job_schedule')
export class JobSchedule {
  @PrimaryColumn('uuid')
  id: string;
  
  @Column({ type: 'varchar', length: 255 })
  name: string;
  
  @Column({ type: 'varchar', length: 100 })
  cron: string;
  
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  data: string;
  
  @Column({ type: 'varchar', length: 100, nullable: true })
  timezone: string;
  
  @Column({ type: 'datetime2', nullable: true })
  lastrun: Date;
  
  @Column({ type: 'datetime2', nullable: true })
  nextrun: Date;
}
```

#### 3.2. Service Implementation

```typescript
@Injectable()
export class MssqlJobQueueService implements IJobQueueService, OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MssqlJobQueueService.name);
  private workers: Map<string, (job: Job) => Promise<void>> = new Map();
  private pollingInterval: NodeJS.Timer;
  private scheduleInterval: NodeJS.Timer;
  private isRunning = false;
  
  constructor(
    @InjectRepository(JobQueue) 
    private jobRepository: Repository<JobQueue>,
    @InjectRepository(JobSchedule)
    private scheduleRepository: Repository<JobSchedule>
  ) {}
  
  async start(): Promise<void> {
    this.isRunning = true;
    
    // Poll for jobs every 1 second
    this.pollingInterval = setInterval(() => this.processJobs(), 1000);
    
    // Check scheduled jobs every minute
    this.scheduleInterval = setInterval(() => this.processSchedules(), 60000);
    
    this.logger.log('MSSQL Job Queue started');
  }
  
  async stop(options?: { graceful?: boolean }): Promise<void> {
    this.isRunning = false;
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    if (this.scheduleInterval) clearInterval(this.scheduleInterval);
    
    if (options?.graceful) {
      // Wait for active jobs to complete (with timeout)
      const timeout = 30000; // 30 seconds
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const activeCount = await this.jobRepository.count({ 
          where: { state: 'active' } 
        });
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
        // Unique constraint violation on singletonKey
        this.logger.warn(`Duplicate job prevented for singleton key: ${options.singletonKey}`);
        const existing = await this.jobRepository.findOne({ 
          where: { singletonKey: options.singletonKey } 
        });
        return existing.id;
      }
      throw error;
    }
  }
  
  async schedule(queueName: string, cron: string, data: any, options?: ScheduleOptions): Promise<void> {
    const schedule = new JobSchedule();
    schedule.id = randomUUID();
    schedule.name = queueName;
    schedule.cron = cron;
    schedule.data = JSON.stringify(data);
    schedule.timezone = options?.tz ?? 'UTC';
    schedule.nextrun = this.calculateNextRun(cron, options?.tz);
    
    await this.scheduleRepository.save(schedule);
    this.logger.log(`Scheduled job ${queueName} with cron ${cron}`);
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
  
  private async processJobs(): Promise<void> {
    if (!this.isRunning) return;
    
    const jobs = await this.jobRepository.find({
      where: { state: In(['created', 'retry']) },
      take: 10,
      order: { createdon: 'ASC' }
    });
    
    for (const job of jobs) {
      await this.executeJob(job);
    }
  }
  
  private async executeJob(job: JobQueue): Promise<void> {
    const handler = this.workers.get(job.name);
    if (!handler) {
      this.logger.warn(`No worker registered for queue: ${job.name}`);
      return;
    }
    
    // Check expiration
    if (job.expirein && new Date() > job.expirein) {
      await this.jobRepository.update(job.id, { 
        state: 'expired',
        completedon: new Date()
      });
      return;
    }
    
    // Mark as active
    await this.jobRepository.update(job.id, { 
      state: 'active',
      startedon: new Date()
    });
    
    try {
      const jobData: Job = {
        id: job.id,
        name: job.name,
        data: JSON.parse(job.data),
        state: 'active',
        createdon: job.createdon,
        startedon: job.startedon,
        completedon: job.completedon,
        output: job.output ? JSON.parse(job.output) : undefined,
        retrycount: job.retrycount,
      };
      
      await handler(jobData);
      
      // Mark as completed
      await this.jobRepository.update(job.id, { 
        state: 'completed',
        completedon: new Date()
      });
      
      this.logger.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
      
      // Retry logic
      if (job.retrycount < job.retrylimit) {
        const nextRetry = job.retrybackoff 
          ? Math.pow(2, job.retrycount) * (job.retrydelay || 1000)
          : job.retrydelay || 1000;
        
        await this.jobRepository.update(job.id, {
          state: 'retry',
          retrycount: job.retrycount + 1,
          output: JSON.stringify({
            error: error.message,
            stack: error.stack,
          })
        });
        
        this.logger.log(`Job ${job.id} will retry in ${nextRetry}ms`);
      } else {
        await this.jobRepository.update(job.id, {
          state: 'failed',
          completedon: new Date(),
          output: JSON.stringify({
            error: error.message,
            stack: error.stack,
          })
        });
      }
    }
  }
  
  private async processSchedules(): Promise<void> {
    if (!this.isRunning) return;
    
    const now = new Date();
    const schedules = await this.scheduleRepository.find({
      where: { nextrun: LessThanOrEqual(now) }
    });
    
    for (const schedule of schedules) {
      await this.send(
        schedule.name,
        schedule.data ? JSON.parse(schedule.data) : null
      );
      
      await this.scheduleRepository.update(schedule.id, {
        lastrun: now,
        nextrun: this.calculateNextRun(schedule.cron, schedule.timezone)
      });
    }
  }
  
  private calculateNextRun(cron: string, timezone?: string): Date {
    const parser = require('cron-parser');
    const interval = parser.parseExpression(cron, {
      currentDate: new Date(),
      tz: timezone || 'UTC'
    });
    return interval.next().toDate();
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
  imports: [
    TypeOrmModule.forFeature([JobQueue, JobSchedule]),
  ],
  providers: [
    {
      provide: 'IJobQueueService',
      useFactory: async (
        jobRepo: Repository<JobQueue>,
        scheduleRepo: Repository<JobSchedule>
      ) => {
        if (config.DB_ENGINE === 'mssql') {
          return new MssqlJobQueueService(jobRepo, scheduleRepo);
        } else {
          const connectionString = await config.DB_CONNECTION_STRING;
          return new PgBossAdapter(connectionString);
        }
      },
      inject: [getRepositoryToken(JobQueue), getRepositoryToken(JobSchedule)],
    },
  ],
  exports: ['IJobQueueService'],
})
export class JobQueueModule {}
```

---

### 5. Update SbSyncQueue View for MSSQL

The `SbSyncQueue` materialized view currently queries the `pgboss.job` and `pgboss.archive` tables. For MSSQL, it should query the `job_queue` table instead.

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
- [ ] Implement `PgBossAdapter` to wrap existing pgboss functionality
- [ ] Create `JobQueueModule` with factory pattern
- [ ] Update `SbSyncConsumer` to use `IJobQueueService` injection
- [ ] Update controllers to use `IJobQueueService` injection
- [ ] **Test thoroughly on PostgreSQL** - ensure no regression
- [ ] Run all existing unit and integration tests
- [ ] Verify sync functionality in dev/staging environments

### Phase 2: MSSQL Implementation

- [ ] Create `JobQueue` and `JobSchedule` entities
- [ ] Generate MSSQL migration for job queue tables with indexes
- [ ] Implement `MssqlJobQueueService` with polling mechanism
- [ ] Create conditional view definition for `SbSyncQueue` (MSSQL version)
- [ ] Generate MSSQL migration to replace materialized view with regular view
- [ ] Add `cron-parser` dependency to `package.json` (Note: This dependency is only loaded/used when `DB_ENGINE=mssql`. PostgreSQL deployments using pgboss do not need this package.)
- [ ] Write unit tests for `MssqlJobQueueService`
  - Test job submission
  - Test singleton key enforcement
  - Test retry logic
  - Test expiration handling
  - Test cron scheduling
- [ ] Test MSSQL implementation in isolated environment
- [ ] Load test to validate performance (100+ jobs)

### Phase 3: Integration & Validation

- [ ] Update documentation (this file and `sb-sync-functionality.md`)
- [ ] Create deployment guide for MSSQL users
- [ ] Run end-to-end tests with MSSQL database
- [ ] Verify UI displays job status correctly on MSSQL
- [ ] Performance comparison between pgboss and MSSQL implementation
- [ ] Document any behavioral differences (if any)
- [ ] Final code review and security scan
- [ ] Update configuration docs for `DB_ENGINE` setting

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
4. ✅ **No New Dependencies:** Only TypeORM and standard libraries
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
