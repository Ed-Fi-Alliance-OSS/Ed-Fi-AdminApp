import { parseExpression } from 'cron-parser'; // pinned to ^3.1.0 (D-13)
import { Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';
import config from 'config';
import { JobQueue } from '@edanalytics/models-server';
import { IJobQueueService, Job, JobOptions, ScheduleOptions } from './job-queue.interface';

@Injectable()
export class MssqlJobQueueService
  implements IJobQueueService, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(MssqlJobQueueService.name);
  private workers = new Map<string, (job: Job) => Promise<unknown>>();
  // In-process schedule registry — no DB table (D-10)
  private scheduleRegistry = new Map<string, { cron: string; data: unknown; tz: string }>();
  private lastScheduleFire = new Map<string, Date>();
  private pollingTimer: NodeJS.Timeout | undefined;
  private scheduleTimer: NodeJS.Timeout | undefined;
  private isRunning = false;
  private readonly pollIntervalMs: number;
  private readonly scheduleIntervalMs: number;

  constructor(
    @InjectRepository(JobQueue)
    private readonly jobRepository: Repository<JobQueue>
  ) {
    this.pollIntervalMs = config.MSSQL_JOB_POLL_MS ?? 1000;
    this.scheduleIntervalMs = config.MSSQL_SCHEDULE_POLL_MS ?? 10000;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    await this.recoverStaleJobs();
    void this.runJobLoop();
    void this.runScheduleLoop();
    this.logger.log('MSSQL Job Queue started');
  }

  async stop(options?: { graceful?: boolean; destroy?: boolean }): Promise<void> {
    this.isRunning = false;
    if (this.pollingTimer) clearTimeout(this.pollingTimer);
    if (this.scheduleTimer) clearTimeout(this.scheduleTimer);

    if (options?.graceful) {
      const timeout = 30_000;
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const activeCount = await this.jobRepository.count({ where: { state: 'active' } });
        if (activeCount === 0) break;
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
      }
    }
    this.logger.log('MSSQL Job Queue stopped');
  }

  async send<T = object>(queueName: string, data: T | null, options?: JobOptions): Promise<string> {
    const job = new JobQueue();
    job.id = randomUUID();
    job.name = queueName;
    job.data = JSON.stringify(data ?? {});
    job.state = 'created';
    job.createdon = new Date();
    job.singletonKey = options?.singletonKey ?? null;
    job.retrylimit = options?.retryLimit ?? 3;
    job.retrydelay = options?.retryDelay ?? 0;
    job.retrybackoff = options?.retryBackoff ?? false;

    if (options?.expireInHours) {
      job.expirein = new Date(Date.now() + options.expireInHours * 3_600_000);
    }

    try {
      await this.jobRepository.save(job);
      this.logger.log(`Job ${job.id} queued for ${queueName}`);
      return job.id;
    } catch (error) {
      // MSSQL unique constraint violation codes: 2601 (duplicate key row) or 2627 (unique constraint)
      const code = (error as { number?: number })?.number;
      if (code === 2601 || code === 2627) {
        this.logger.warn(`Duplicate job prevented for singleton key: ${options?.singletonKey}`);
        // Constrain by active states to avoid returning a stale completed/failed row (D-08)
        const existing = await this.jobRepository.findOne({
          where: {
            singletonKey: options?.singletonKey,
            state: In(['created', 'retry', 'active']),
          },
        });
        return existing?.id ?? job.id;
      }
      throw error;
    }
  }

  // Registers an in-process cron schedule — no DB persistence needed for v1 (D-10)
  async schedule(
    queueName: string,
    cron: string,
    data: unknown,
    options?: ScheduleOptions
  ): Promise<void> {
    this.scheduleRegistry.set(queueName, { cron, data, tz: options?.tz ?? 'UTC' });
    this.logger.log(`Cron schedule registered in-process for queue: ${queueName} (${cron})`);
  }

  async work<T = object>(
    queueName: string,
    handler: (job: Job<T>) => Promise<unknown>
  ): Promise<void> {
    this.workers.set(queueName, handler as (job: Job) => Promise<unknown>);
    this.logger.log(`Worker registered for queue: ${queueName}`);
  }

  async getJobById(id: string): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id } });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return {
      id: job.id,
      name: job.name,
      data: job.data ? JSON.parse(job.data) : {},
      state: job.state as Job['state'],
      createdon: job.createdon,
      startedon: job.startedon ?? undefined,
      completedon: job.completedon ?? undefined,
      output: job.output ? JSON.parse(job.output) : undefined,
      retrycount: job.retrycount,
    };
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stop({ graceful: true });
  }

  // ---- Private methods ----

  // Guarded loop — next tick only starts after the current one finishes (D-09)
  private async runJobLoop(): Promise<void> {
    if (!this.isRunning) return;
    try {
      await this.processJobs();
    } finally {
      if (this.isRunning) {
        this.pollingTimer = setTimeout(() => void this.runJobLoop(), this.pollIntervalMs);
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
        this.scheduleTimer = setTimeout(() => void this.runScheduleLoop(), this.scheduleIntervalMs);
      }
    }
  }

  // Atomically claim up to 10 eligible jobs using MSSQL locking hints (D-01)
  private async processJobs(): Promise<void> {
    if (!this.isRunning) return;

    const leaseUntil = new Date(Date.now() + 5 * 60 * 1000); // 5-minute lease (D-02)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claimed: JobQueue[] = await this.jobRepository.query(
      `UPDATE TOP (10) job_queue WITH (UPDLOCK, ROWLOCK, READPAST)
       SET state      = 'active',
           startedon  = GETUTCDATE(),
           leaseUntil = @0
       OUTPUT INSERTED.*
       WHERE state IN ('created', 'retry')
         AND (availableAt IS NULL OR availableAt <= GETUTCDATE())
         AND (expirein    IS NULL OR expirein    >  GETUTCDATE())`,
      [leaseUntil]
    );

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
        data: job.data ? JSON.parse(job.data) : {},
        state: 'active',
        createdon: job.createdon,
        startedon: job.startedon ?? new Date(),
        completedon: job.completedon ?? undefined,
        output: job.output ? JSON.parse(job.output) : undefined,
        retrycount: job.retrycount,
      };

      await handler(jobData);

      await this.jobRepository.update(job.id, {
        state: 'completed',
        completedon: new Date(),
      });

      this.logger.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Job ${job.id} failed: ${err.message}`, err.stack);

      if (job.retrycount < job.retrylimit) {
        const nextRetryMs = job.retrybackoff
          ? Math.pow(2, job.retrycount) * (job.retrydelay || 1000)
          : job.retrydelay || 1000;

        await this.jobRepository.update(job.id, {
          state: 'retry',
          retrycount: job.retrycount + 1,
          availableAt: new Date(Date.now() + nextRetryMs), // persist delay so poll respects it (D-06)
          output: JSON.stringify({ error: err.message, stack: err.stack }),
        });

        this.logger.log(`Job ${job.id} will retry in ${nextRetryMs}ms`);
      } else {
        await this.jobRepository.update(job.id, {
          state: 'failed',
          completedon: new Date(),
          output: JSON.stringify({ error: err.message, stack: err.stack }),
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
    // TypeORM raw query result for UPDATE on MSSQL: array with rowsAffected
    const recovered: number = Array.isArray(result) ? (result[1] ?? 0) : 0;
    if (recovered > 0) {
      this.logger.warn(`Recovered ${recovered} stale active job(s) on startup`);
    }
  }

  // Advisory lock via sp_getapplock — ensures only one instance fires a given schedule (D-07)
  private async tryAcquireSchedulerLock(name: string): Promise<boolean> {
    const result = await this.jobRepository.query(
      `DECLARE @ret INT;
       EXEC @ret = sp_getapplock @Resource = @0, @LockMode = 'Exclusive', @LockOwner = 'Session', @LockTimeout = 0;
       SELECT @ret AS returnCode;`,
      [`scheduler_${name}`]
    );
    const returnCode: number = Array.isArray(result) && result[0] ? result[0].returnCode : -1;
    return returnCode >= 0;
  }

  private async releaseSchedulerLock(name: string): Promise<void> {
    await this.jobRepository.query(
      `EXEC sp_releaseapplock @Resource = @0, @LockOwner = 'Session'`,
      [`scheduler_${name}`]
    );
  }
}
