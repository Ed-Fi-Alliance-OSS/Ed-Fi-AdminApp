// EdOrg privilege constants
export const EDORG_PRIVILEGES = {
  // ODS-level EdOrg operations
  CREATE: 'team.sb-environment.edfi-tenant.ods:create-edorg',
  DELETE: 'team.sb-environment.edfi-tenant.ods:delete-edorg',

  // Individual EdOrg operations
  READ: 'team.sb-environment.edfi-tenant.ods.edorg:read',
} as const;

// Type for privilege values
export type EdorgPrivilege = typeof EDORG_PRIVILEGES[keyof typeof EDORG_PRIVILEGES];
