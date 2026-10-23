import type { EdfiTenant } from '@edanalytics/models-server';
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import {
  AUDIT_ADMIN_API_DELETE_METADATA,
  AuditAdminApiDeleteMetadata,
} from './audit-admin-api-delete.decorator';
import { AUDIT_ENABLED } from './audit-enabled.token';
import { setAuditSnapshot } from './audit-request-context';

/**
 * Loads the Admin API resource named by `@AuditAdminApiDelete` before the handler runs and attaches
 * an allowlisted snapshot to the request. Never throws: a failed lookup only skips the snapshot.
 * Does nothing when audit logging is disabled. Must run after SbEnvironmentEdfiTenantInterceptor.
 */
@Injectable()
export class AuditAdminApiDeleteInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditAdminApiDeleteInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
    @Inject(AUDIT_ENABLED) private readonly enabled: boolean,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (!this.enabled) {
      return next.handle();
    }
    try {
      await this.snapshot(context);
    } catch (err) {
      this.logger.warn(
        `Admin API delete snapshot skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return next.handle();
  }

  private async snapshot(context: ExecutionContext): Promise<void> {
    if (context.getType() !== 'http') return;
    const meta = this.reflector.get<AuditAdminApiDeleteMetadata | undefined>(
      AUDIT_ADMIN_API_DELETE_METADATA,
      context.getHandler(),
    );
    if (!meta) return;

    const req = context.switchToHttp().getRequest<Request & { edfiTenant?: EdfiTenant }>();
    const edfiTenant = req.edfiTenant;
    const raw = req.params?.[meta.idParam];
    if (!edfiTenant || typeof raw !== 'string' || !/^\d+$/.test(raw)) return;
    const id = Number(raw);
    if (!Number.isSafeInteger(id)) return;

    const snapshot = await meta.load({ moduleRef: this.moduleRef, edfiTenant, id });
    if (snapshot) setAuditSnapshot(req, snapshot);
  }
}
