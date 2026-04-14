import { Injectable, NotFoundException, OnApplicationShutdown } from '@nestjs/common';
import PgBoss from 'pg-boss';
import { IJobQueueService, Job, JobOptions, ScheduleOptions } from './job-queue.interface';

@Injectable()
export class PgBossAdapter implements IJobQueueService, OnApplicationShutdown {
  constructor(private readonly boss: PgBoss) {}

  async start(): Promise<void> {
    await this.boss.start();
  }

  async stop(options?: { graceful?: boolean; destroy?: boolean }): Promise<void> {
    await this.boss.stop(options);
  }

  async send<T = object>(queueName: string, data: T | null, options?: JobOptions): Promise<string> {
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
      async (pgJob: PgBoss.JobWithMetadata<T>) => {
        await handler({
          id: pgJob.id,
          name: pgJob.name,
          data: pgJob.data,
          state: pgJob.state,
          createdon: pgJob.createdon,
          startedon: pgJob.startedon,
          completedon: pgJob.completedon ?? undefined,
          output: pgJob.output,
          retrycount: pgJob.retrycount,
        });
      }
    );
  }

  async getJobById(id: string): Promise<Job> {
    const pgJob = await this.boss.getJobById(id);
    if (!pgJob) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    return {
      id: pgJob.id,
      name: pgJob.name,
      data: pgJob.data,
      state: pgJob.state,
      createdon: pgJob.createdon,
      startedon: pgJob.startedon,
      completedon: pgJob.completedon ?? undefined,
      output: pgJob.output,
      retrycount: pgJob.retrycount,
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stop({ graceful: false, destroy: true });
  }
}
