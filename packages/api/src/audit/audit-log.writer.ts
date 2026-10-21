import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { AuditLog } from '@edanalytics/models-server';
import { Repository } from 'typeorm';
import { AuditEvent } from './audit-event';
import { AuditEventQueue } from './audit-event.queue';
import { safeStringify } from './audit-sanitizer';

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
  private inFlight?: Promise<void>;

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
    this.timer.unref?.();
  }

  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    this.timer = undefined;
    await this.inFlight;
    while (this.enabled && this.queue.size > 0) {
      await this.flush();
    }
  }

  /** Never rejects. Concurrent callers share the flush already in progress. */
  flush(): Promise<void> {
    if (!this.enabled) {
      return Promise.resolve();
    }
    this.inFlight ??= this.flushBatch().finally(() => (this.inFlight = undefined));
    return this.inFlight;
  }

  private async flushBatch(): Promise<void> {
    const batch = this.queue.drain(this.options.batchSize);
    if (batch.length === 0) {
      return;
    }
    if (!(await this.insertWithRetry(batch))) {
      await this.insertOneByOne(batch);
    }
  }

  /** After the batch fails for good, a single bad row must not take the other rows down with it. */
  private async insertOneByOne(batch: AuditEvent[]): Promise<void> {
    for (const event of batch) {
      try {
        await this.repo.insert([event]);
      } catch {
        this.logNotPersisted(event);
      }
    }
  }

  private logNotPersisted(event: AuditEvent): void {
    this.logger.error(`Audit event not persisted: ${safeStringify(event)}`);
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
