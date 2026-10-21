import { Logger } from '@nestjs/common';
import { AuditEvent, AuditEventType } from './audit-event';
import { AuditEventQueue } from './audit-event.queue';
import { AuditEventRecorder } from './audit-event.recorder';

const event = (overrides: Partial<AuditEvent> = {}): AuditEvent => ({
  eventType: AuditEventType.Action,
  timestamp: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('AuditEventRecorder', () => {
  const logger = { warn: jest.fn() } as unknown as Logger;

  beforeEach(() => jest.clearAllMocks());

  it('records nothing when disabled', () => {
    const queue = new AuditEventQueue(10);

    new AuditEventRecorder(queue, false, logger).record(event());

    expect(queue.size).toBe(0);
  });

  it('sanitizes the username and strips the query string from the url', () => {
    const queue = new AuditEventQueue(10);

    new AuditEventRecorder(queue, true, logger).record(
      event({ actorUsername: 'ali\nce', httpUrl: '/api/things?token=secret#frag' }),
    );

    const [recorded] = queue.drain(1);
    expect(recorded.actorUsername).toBe('alice');
    expect(recorded.httpUrl).toBe('/api/things');
  });

  it('truncates overlong values', () => {
    const queue = new AuditEventQueue(10);

    new AuditEventRecorder(queue, true, logger).record(
      event({ actorUsername: 'a'.repeat(300), httpUrl: '/' + 'b'.repeat(3000) }),
    );

    const [recorded] = queue.drain(1);
    expect(recorded.actorUsername).toHaveLength(256);
    expect(recorded.httpUrl).toHaveLength(2048);
  });

  it('logs the event and does not throw when the queue is full', () => {
    const queue = new AuditEventQueue(0);
    const recorder = new AuditEventRecorder(queue, true, logger);

    expect(() => recorder.record(event({ httpUrl: '/overflow' }))).not.toThrow();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(String((logger.warn as jest.Mock).mock.calls[0][0])).toContain('/overflow');
  });
});
