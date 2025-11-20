import { IOwnershipView, OwnershipResourceType } from '@edanalytics/models';
import { ViewColumn, ViewEntity } from 'typeorm';

/**
 * OwnershipView creates a view where the resource text and type are formatted for display in the UI.
 *
 * The resource type is one of: Edorg, Ods, EdfiTenant, SbEnvironment, or IntegrationProvider.
 *
 * The resource text (resourceText) looks like:
 * - for Integration Providers: "Integration Provider: {integrationProviderName}"
 * - for SB Environments: "{sbEnvironmentName}"
 * - for Edfi Tenants: "{sbEnvironmentName} / {edfiTenantName}"
 * - for ODS's: "{sbEnvironmentName} / {edfiTenantName} / {odsDbName}"
 * - for Edorgs: "{sbEnvironmentName} / {edfiTenantName} / {odsDbName} / {edorgShortName}"
 */
@ViewEntity({
  expression: `SELECT ownership."id",
ownership."teamId",
ownership."roleId",
CASE
    WHEN "ownership"."edorgId" IS NOT NULL THEN 'Edorg'
    WHEN ownership."odsId" IS NOT NULL THEN 'Ods'
    WHEN ownership."edfiTenantId" IS NOT NULL THEN 'EdfiTenant'
    WHEN ownership."integrationProviderId" IS NOT NULL THEN 'IntegrationProvider'
    ELSE 'SbEnvironment' END "resourceType",
COALESCE(sb_environment.name, '') ||
COALESCE(integration_provider.name, '') ||
CASE WHEN edfi_tenant."name" IS NOT NULL THEN ' / ' || edfi_tenant."name" ELSE '' END ||
CASE WHEN ods."dbName" IS NOT NULL THEN ' / ' || ods."dbName" ELSE '' END ||
CASE
    WHEN edorg."shortNameOfInstitution" IS NOT NULL THEN ' / ' || edorg."shortNameOfInstitution"
    WHEN edorg."nameOfInstitution" IS NOT NULL THEN ' / ' || edorg."nameOfInstitution"
    ELSE ''
END "resourceText"
FROM ownership
  LEFT JOIN integration_provider ON ownership."integrationProviderId" = integration_provider.id
  LEFT JOIN edorg ON ownership."edorgId" = edorg.id
  LEFT JOIN ods ON ownership."odsId" = ods.id OR edorg."odsId" = ods.id
  LEFT JOIN edfi_tenant ON ownership."edfiTenantId" = edfi_tenant.id OR ods."edfiTenantId" = edfi_tenant.id
  LEFT JOIN sb_environment ON ownership."sbEnvironmentId" = sb_environment.id
            OR edfi_tenant."sbEnvironmentId" = sb_environment.id`,
})
export class OwnershipView implements IOwnershipView {
  @ViewColumn()
  id: number;

  @ViewColumn()
  teamId: number;

  @ViewColumn()
  roleId: number | null;

  @ViewColumn()
  resourceType: OwnershipResourceType;

  /** Queried efficiently by postgres. Meant to match front-end formatting of links on single-item page. */
  @ViewColumn()
  resourceText: string;
}
