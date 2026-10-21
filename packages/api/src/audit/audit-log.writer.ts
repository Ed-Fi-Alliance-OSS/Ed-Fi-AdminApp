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
  /** How long shutdown waits for pending inserts before logging the remaining events instead. */
  shutdownTimeoutMs: number;
}

const DEFAULT_OPTIONS: AuditLogWriterOptions = {
  flushIntervalMs: 1000,
  // Each row binds 10 parameters, and SQL Server allows at most 2100 per statement:
  // keep batchSize at or below ~200.
  batchSize: 100,
  retryDelaysMs: [250, 1000],
  shutdownTimeoutMs: 5000,
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Persists queued audit events in the background so requests never wait on the database. */
@Injectable()
export class AuditLogWriter implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(AuditLogWriter.name);
  private readonly options: AuditLogWriterOptions;
  private timer?: NodeJS.Timeout;
  private inFlight?: Promise<void>;
  private pendingBatch: AuditEvent[] = [];
  private abandoned = false;

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

  /** Never rejects, and never waits longer than shutdownTimeoutMs for the database. */
  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    this.timer = undefined;
    if (!this.enabled) {
      return;
    }
    if (!(await this.drainWithin(this.options.shutdownTimeoutMs))) {
      this.abandonRemaining();
    }
  }

  /** Resolves true when every event was handled before the timeout, false otherwise. */
  private async drainWithin(timeoutMs: number): Promise<boolean> {
    let timeout: NodeJS.Timeout | undefined;
    const timedOut = new Promise<boolean>((resolve) => {
      timeout = setTimeout(() => resolve(false), timeoutMs);
      timeout.unref?.();
    });
    try {
      return await Promise.race([this.drain().then(() => true), timedOut]);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async drain(): Promise<void> {
    await this.inFlight;
    while (!this.abandoned && this.queue.size > 0) {
      await this.flush();
    }
  }

  /**
   * Logs the in-flight batch and the queue so nothing is silently lost. An in-flight insert that
   * still completes later can leave an event both in the table and in the log.
   */
  private abandonRemaining(): void {
    this.abandoned = true;
    const remaining = [...this.pendingBatch, ...this.queue.drain(this.queue.size)];
    this.pendingBatch = [];
    remaining.forEach((event) => this.logNotPersisted(event));
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
    this.pendingBatch = batch;
    try {
      if (!(await this.insertWithRetry(batch))) {
        await this.insertOneByOne(batch);
      }
    } finally {
      this.pendingBatch = [];
    }
  }

  /** After the batch fails for good, a single bad row must not take the other rows down with it. */
  private async insertOneByOne(batch: AuditEvent[]): Promise<void> {
    for (const event of batch) {
      if (this.abandoned) {
        return; // shutdown already logged this batch
      }
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
