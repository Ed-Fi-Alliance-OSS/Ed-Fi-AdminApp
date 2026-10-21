import type { Request } from 'express';

const AUDIT_SNAPSHOT = Symbol('auditSnapshot');

type WithSnapshot = Request & { [AUDIT_SNAPSHOT]?: Record<string, unknown> };

/** Attaches a pre-change snapshot of an entity to the request, to be stored in the audit details. */
export const setAuditSnapshot = (req: Request, snapshot: Record<string, unknown>): void => {
  (req as WithSnapshot)[AUDIT_SNAPSHOT] = snapshot;
};

export const getAuditSnapshot = (req: Request): Record<string, unknown> | undefined =>
  (req as WithSnapshot)[AUDIT_SNAPSHOT];
