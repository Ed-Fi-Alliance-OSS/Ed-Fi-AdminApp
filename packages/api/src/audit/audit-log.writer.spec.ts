import { Logger } from '@nestjs/common';
import { AuditLog } from '@edanalytics/models-server';
import { Repository } from 'typeorm';
import { AuditEvent, AuditEventType } from './audit-event';
import { AuditEventQueue } from './audit-event.queue';
import { AuditLogWriter } from './audit-log.writer';

const event = (httpUrl: string): AuditEvent => ({
  eventType: AuditEventType.Action,
  timestamp: new Date('2026-01-01T00:00:00Z'),
  httpUrl,
});

describe('AuditLogWriter', () => {
  const options = { flushIntervalMs: 1000, batchSize: 100, retryDelaysMs: [10, 20] };
  let insert: jest.Mock;
  let repo: Repository<AuditLog>;
  let queue: AuditEventQueue;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    insert = jest.fn().mockResolvedValue(undefined);
    repo = { insert } as unknown as Repository<AuditLog>;
    queue = new AuditEventQueue(100);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('inserts queued events on flush', async () => {
    queue.enqueue(event('/1'));
    queue.enqueue(event('/2'));

    await new AuditLogWriter(queue, repo, true, options).flush();

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0].map((e: AuditEvent) => e.httpUrl)).toEqual(['/1', '/2']);
    expect(queue.size).toBe(0);
  });

  it('does not touch the repository when the queue is empty', async () => {
    await new AuditLogWriter(queue, repo, true, options).flush();

    expect(insert).not.toHaveBeenCalled();
  });

  it('retries a failed insert until it succeeds', async () => {
    insert.mockRejectedValueOnce(new Error('down')).mockRejectedValueOnce(new Error('down'));
    queue.enqueue(event('/1'));

    const flushing = new AuditLogWriter(queue, repo, true, options).flush();
    await jest.advanceTimersByTimeAsync(30);
    await flushing;

    expect(insert).toHaveBeenCalledTimes(3);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs the events and resolves when every attempt fails', async () => {
    insert.mockRejectedValue(new Error('down'));
    queue.enqueue(event('/lost'));

    const flushing = new AuditLogWriter(queue, repo, true, options).flush();
    await jest.advanceTimersByTimeAsync(30);
    await expect(flushing).resolves.toBeUndefined();

    expect(insert).toHaveBeenCalledTimes(3);
    expect(errorSpy.mock.calls.some(([message]) => String(message).includes('/lost'))).toBe(true);
  });

  it('flushes on the timer', async () => {
    const writer = new AuditLogWriter(queue, repo, true, options);
    writer.onModuleInit();
    queue.enqueue(event('/1'));

    await jest.advanceTimersByTimeAsync(1000);

    expect(insert).toHaveBeenCalledTimes(1);
    await writer.onApplicationShutdown();
  });

  it('stops the timer and flushes everything remaining on shutdown', async () => {
    const writer = new AuditLogWriter(queue, repo, true, { ...options, batchSize: 2 });
    writer.onModuleInit();
    for (let i = 0; i < 5; i++) queue.enqueue(event(`/${i}`));

    await writer.onApplicationShutdown();

    expect(queue.size).toBe(0);
    expect(insert).toHaveBeenCalledTimes(3);
    queue.enqueue(event('/after'));
    await jest.advanceTimersByTimeAsync(5000);
    expect(queue.size).toBe(1);
  });

  it('never calls the repository when disabled', async () => {
    const writer = new AuditLogWriter(queue, repo, false, options);
    writer.onModuleInit();
    queue.enqueue(event('/1'));

    await jest.advanceTimersByTimeAsync(5000);
    await writer.flush();
    await writer.onApplicationShutdown();

    expect(insert).not.toHaveBeenCalled();
  });

  it('resolves and logs every event even when serialization throws', async () => {
    insert.mockRejectedValue(new Error('down'));
    const circular: AuditEvent = event('/circular');
    (circular as unknown as { self: unknown }).self = circular;
    queue.enqueue(circular);
    queue.enqueue({ ...event('/bigint'), details: 1n as unknown as string });

    const flushing = new AuditLogWriter(queue, repo, true, options).flush();
    await jest.advanceTimersByTimeAsync(30);
    await expect(flushing).resolves.toBeUndefined();

    expect(errorSpy.mock.calls.filter(([m]) => String(m).includes('not persisted'))).toHaveLength(
      2,
    );
  });

  it('keeps only one flush in flight while an insert is pending', async () => {
    insert.mockReturnValue(new Promise(() => undefined));
    const writer = new AuditLogWriter(queue, repo, true, options);
    writer.onModuleInit();
    queue.enqueue(event('/1'));

    await jest.advanceTimersByTimeAsync(5000);
    queue.enqueue(event('/2'));
    await jest.advanceTimersByTimeAsync(5000);

    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('waits for an in-flight flush on shutdown', async () => {
    let finish: () => void = () => undefined;
    insert.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const writer = new AuditLogWriter(queue, repo, true, options);
    writer.onModuleInit();
    queue.enqueue(event('/1'));
    await jest.advanceTimersByTimeAsync(1000);

    let done = false;
    const shutdown = writer.onApplicationShutdown().then(() => (done = true));
    await jest.advanceTimersByTimeAsync(100);
    expect(done).toBe(false);

    finish();
    await shutdown;
    expect(done).toBe(true);
  });
});
