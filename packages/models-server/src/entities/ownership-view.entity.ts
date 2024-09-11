import { IOwnershipView } from '@edanalytics/models';
import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  expression: `SELECT ownership."id",
ownership."teamId",
ownership."roleId",
CASE
    WHEN "ownership"."edorgId" IS NOT NULL then 'Edorg'
    WHEN ownership."odsId" IS NOT NULL THEN 'Ods'
    WHEN ownership."edfiTenantId" IS NOT NULL THEN 'EdfiTenant'
    ELSE 'SbEnvironment' END "resourceType",
sb_environment.name ||
CASE WHEN edfi_tenant."name" IS NOT NULL THEN ' / ' || edfi_tenant."name" ELSE '' END ||
CASE WHEN ods."dbName" IS NOT NULL THEN ' / ' || ods."dbName" ELSE '' END ||
CASE
    WHEN edorg."shortNameOfInstitution" IS NOT NULL THEN ' / ' || edorg."shortNameOfInstitution"
    WHEN edorg."nameOfInstitution" IS NOT NULL THEN ' / ' || edorg."nameOfInstitution"
    ELSE '' END              "resourceText"
FROM ownership
  LEFT JOIN edorg ON ownership."edorgId" = edorg.id
  LEFT JOIN ods ON ownership."odsId" = ods.id OR edorg."odsId" = ods.id
  LEFT JOIN edfi_tenant ON ownership."edfiTenantId" = edfi_tenant.id OR ods."edfiTenantId" = edfi_tenant.id
  LEFT JOIN sb_environment ON ownership."sbEnvironmentId" = sb_environment.id or
                              edfi_tenant."sbEnvironmentId" = sb_environment.id`,
})
export class OwnershipView implements IOwnershipView {
  @ViewColumn()
  id: number;

  @ViewColumn()
  teamId: number;

  @ViewColumn()
  roleId: number | null;

  @ViewColumn()
  resourceType: 'Edorg' | 'Ods' | 'EdfiTenant' | 'SbEnvironment';

  /** Queried efficiently by postgres. Meant to match front-end formatting of links on single-item page. */
  @ViewColumn()
  resourceText: string;
}
