import { Global, Module, Provider } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '@edanalytics/models-server';
import config from 'config';
import { Repository } from 'typeorm';
import { asBool } from '../utils/config-bool';
import { AuditActionMiddleware } from './audit-action.middleware';
import { AuditDeleteInterceptor } from './audit-delete.interceptor';
import { AuditEventQueue } from './audit-event.queue';
import { AuditEventRecorder } from './audit-event.recorder';
import { AuditLogWriter } from './audit-log.writer';
import './delete-snapshot.registrations';

export const AUDIT_QUEUE_CAPACITY = 10_000;
export const AUDIT_ENABLED = Symbol('AUDIT_ENABLED');

/** The audit flag defaults to ON when it is not configured. */
export const isAuditEnabled = (value: unknown): boolean =>
  value === undefined ? true : asBool(value);

export const auditProviders: Provider[] = [
  { provide: AUDIT_ENABLED, useFactory: () => isAuditEnabled(config.AUDIT_LOGGING_ENABLED) },
  { provide: AuditEventQueue, useFactory: () => new AuditEventQueue(AUDIT_QUEUE_CAPACITY) },
  {
    provide: AuditEventRecorder,
    useFactory: (queue: AuditEventQueue, enabled: boolean) =>
      new AuditEventRecorder(queue, enabled),
    inject: [AuditEventQueue, AUDIT_ENABLED],
  },
  {
    provide: AuditLogWriter,
    useFactory: (queue: AuditEventQueue, repo: Repository<AuditLog>, enabled: boolean) =>
      new AuditLogWriter(queue, repo, enabled),
    inject: [AuditEventQueue, getRepositoryToken(AuditLog), AUDIT_ENABLED],
  },
  AuditActionMiddleware,
  { provide: APP_INTERCEPTOR, useClass: AuditDeleteInterceptor },
];

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: auditProviders,
  exports: [AuditEventRecorder],
})
export class AuditModule {}
