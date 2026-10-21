import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { AuditLog } from '@edanalytics/models-server';
import { Repository } from 'typeorm';
import { AuditEvent } from './audit-event';
import { AuditEventQueue } from './audit-event.queue';

export interface AuditLogWriterOptions {
  flushIntervalMs: number;
  batchSize: number;
  retryDelaysMs: number[];
}

const DEFAULT_OPTIONS: AuditLogWriterOptions = {
  flushIntervalMs: 1000,
  batchSize: 100,
  retryDelaysMs: [250, 1000],
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Persists queued audit events in the background so requests never wait on the database. */
@Injectable()
export class AuditLogWriter implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(AuditLogWriter.name);
  private readonly options: AuditLogWriterOptions;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly queue: AuditEventQueue,
    private readonly repo: Repository<AuditLog>,
    private readonly enabled: boolean,
    options: Partial<AuditLogWriterOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  onModuleInit(): void {
    if (!this.enabled) {
      return;
    }
    this.timer = setInterval(() => void this.flush(), this.options.flushIntervalMs);
  }

  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    this.timer = undefined;
    while (this.enabled && this.queue.size > 0) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    const batch = this.queue.drain(this.options.batchSize);
    if (batch.length === 0) {
      return;
    }
    if (!(await this.insertWithRetry(batch))) {
      batch.forEach((event) =>
        this.logger.error(`Audit event not persisted: ${JSON.stringify(event)}`),
      );
    }
  }

  private async insertWithRetry(batch: AuditEvent[]): Promise<boolean> {
    for (let attempt = 0; ; attempt++) {
      try {
        await this.repo.insert(batch);
        return true;
      } catch (error) {
        if (attempt >= this.options.retryDelaysMs.length) {
          this.logger.error(`Audit insert failed after ${attempt + 1} attempts: ${error}`);
          return false;
        }
        await delay(this.options.retryDelaysMs[attempt]);
      }
    }
  }
}
