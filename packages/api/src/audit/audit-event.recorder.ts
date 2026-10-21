import { Injectable, Logger } from '@nestjs/common';
import { AuditEvent } from './audit-event';
import { AuditEventQueue } from './audit-event.queue';
import { sanitizeText, stripQueryString } from './audit-sanitizer';

const MAX_USERNAME_LENGTH = 256;
const MAX_URL_LENGTH = 2048;

/** Entry point for emitting audit events. Never throws: auditing must not break the request. */
@Injectable()
export class AuditEventRecorder {
  constructor(
    private readonly queue: AuditEventQueue,
    private readonly enabled: boolean,
    private readonly logger: Logger = new Logger(AuditEventRecorder.name),
  ) {}

  record(event: AuditEvent): void {
    if (!this.enabled) {
      return;
    }
    try {
      const sanitized: AuditEvent = {
        ...event,
        actorUsername: sanitizeText(event.actorUsername, MAX_USERNAME_LENGTH),
        httpUrl: event.httpUrl
          ? sanitizeText(stripQueryString(event.httpUrl), MAX_URL_LENGTH)
          : null,
      };
      if (!this.queue.enqueue(sanitized)) {
        this.logger.warn(`Audit queue full, event not persisted: ${JSON.stringify(sanitized)}`);
      }
    } catch (error) {
      this.logger.error(`Failed to record audit event: ${error}`);
    }
  }
}
