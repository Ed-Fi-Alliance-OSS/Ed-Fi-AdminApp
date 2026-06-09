import { Injectable, NotFoundException, OnApplicationShutdown } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import { IJobQueueService, Job, JobOptions, ScheduleOptions } from './job-queue.interface';

@Injectable()
export class PgBossAdapter implements IJobQueueService, OnApplicationShutdown {
  private readonly queueNamesByJobId = new Map<string, string>();

  constructor(private readonly boss: PgBoss) {}

  async start(): Promise<void> {
    await this.boss.start();
  }

  async stop(options?: { graceful?: boolean; destroy?: boolean }): Promise<void> {
    await this.boss.stop(options);
  }

  /** Idempotently create the named queue in pgboss.queue (required by pg-boss v12). */
  async createQueue(name: string): Promise<void> {
    await this.boss.createQueue(name);
  }

  async send<T = object>(
    queueName: string,
    data: T | null,
    options?: JobOptions
  ): Promise<string> {
    // Normalize null/undefined to an empty object — pg-boss expects an object payload.
    const payload = (data ?? {}) as object;
    const id = await this.boss.send(queueName, payload, {
      ...(options?.singletonKey !== undefined && { singletonKey: options.singletonKey }),
      ...(options?.expireInHours !== undefined && { expireInHours: options.expireInHours }),
      ...(options?.retryLimit !== undefined && { retryLimit: options.retryLimit }),
      ...(options?.retryDelay !== undefined && { retryDelay: options.retryDelay }),
      ...(options?.retryBackoff !== undefined && { retryBackoff: options.retryBackoff }),
    });
    // pg-boss v9 returns null when a singleton duplicate is silently deduped (D-14)
    if (id === null) {
      return options?.singletonKey ?? 'deduped';
    }
    this.queueNamesByJobId.set(id, queueName);
    return id;
  }

  async schedule(
    queueName: string,
    cron: string,
    data: unknown,
    options?: ScheduleOptions
  ): Promise<void> {
    // Normalize null/undefined to an empty object — pg-boss expects an object payload.
    const payload = (data ?? {}) as object;
    await this.boss.schedule(queueName, cron, payload, { tz: options?.tz });
  }

  async work<T = object>(
    queueName: string,
    handler: (job: Job<T>) => Promise<unknown>
  ): Promise<void> {
    await this.boss.work<T>(
      queueName,
      { includeMetadata: true },
      async (pgJobs) => {
        for (const pgJob of pgJobs) {
          await handler({
            id: pgJob.id,
            name: pgJob.name,
            data: pgJob.data,
            state: pgJob.state,
            createdon: pgJob.createdOn,
            startedon: pgJob.startedOn,
            completedon: pgJob.completedOn ?? undefined,
            output: pgJob.output,
            retrycount: pgJob.retryCount,
          });
        }
      }
    );
  }

  async getJobById(id: string): Promise<Job> {
    const queueName = this.queueNamesByJobId.get(id);
    if (!queueName) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    const pgJob = await this.boss.getJobById(queueName, id);
    if (!pgJob) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    return {
      id: pgJob.id,
      name: pgJob.name,
      data: pgJob.data as object,
      state: pgJob.state,
      createdon: pgJob.createdOn,
      startedon: pgJob.startedOn,
      completedon: pgJob.completedOn ?? undefined,
      output: pgJob.output,
      retrycount: pgJob.retryCount,
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stop({ graceful: false, destroy: true });
  }
}
