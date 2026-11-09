import { GLOBAL_ADMIN_ROLE_ID, GLOBAL_ADMIN_ROLE_TYPE } from './ac644-privilege-snapshot';

export { GLOBAL_ADMIN_ROLE_ID, GLOBAL_ADMIN_ROLE_TYPE };

/**
 * Frozen constants for the AC-652 "Certification vendor" migrations.
 *
 * Used only by the AddCertificationVendorRole1793100000000 migrations. Do NOT import
 * from @edanalytics/models here: migrations must not change meaning when the model changes.
 */
export const AC652_CERTIFICATION_PRIVILEGE_CODES: readonly string[] = [
  'team.sb-environment.edfi-tenant.ods.certification:read',
  'team.sb-environment.edfi-tenant.ods.certification:run',
];

/** Shared-instance ownership (4) and Full ownership (5) also receive the certification codes. */
export const AC652_GRANTEE_ROLE_IDS = [4, 5] as const;
/** Roles 4 and 5 are only updated while they are still the seeded ResourceOwnership roles. */
export const AC652_GRANTEE_ROLE_TYPE = '"ResourceOwnership"';

export const CERTIFICATION_VENDOR_ROLE_NAME = 'Certification vendor';
export const CERTIFICATION_VENDOR_ROLE_DESCRIPTION =
  "Views and runs certifications for the team's data stores.";
export const CERTIFICATION_VENDOR_ROLE_TYPE = '"UserTeam"';

export const CERTIFICATION_VENDOR_PRIVILEGE_CODES: readonly string[] = [
  ...AC652_CERTIFICATION_PRIVILEGE_CODES,
  'team.sb-environment:read',
  'team.sb-environment.edfi-tenant:read',
  'team.sb-environment.edfi-tenant.ods:read',
];
