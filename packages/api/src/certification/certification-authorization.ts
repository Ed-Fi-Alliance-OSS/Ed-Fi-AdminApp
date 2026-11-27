/**
 * How the team-scoped certification routes are authorized (AC-651, privileges from AC-652).
 * Both privileges are granted per data store, and the data store isn't in the route: the guard
 * checks that the user holds the privilege somewhere in the tenant (`__filtered__`), and each
 * handler then checks the data store itself against the IDs the privilege covers.
 */
export const CERT_READ = 'team.sb-environment.edfi-tenant.ods.certification:read' as const;
export const CERT_RUN = 'team.sb-environment.edfi-tenant.ods.certification:run' as const;

export const CERT_TENANT_SUBJECT = {
  id: '__filtered__',
  edfiTenantId: 'edfiTenantId',
  teamId: 'teamId',
} as const;

/** The base path of every tenant-scoped certification route. */
export const CERT_TENANT_PATH = 'teams/:teamId/edfi-tenants/:edfiTenantId/certification';
