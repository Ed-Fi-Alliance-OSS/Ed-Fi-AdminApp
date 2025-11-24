import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntegrationProviderToOwnership1744919046622 implements MigrationInterface {
  name = 'AddIntegrationProviderToOwnership1744919046622';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE [type] = $1 AND [name] = $2 AND "schema" = $3`,
      ['VIEW', 'ownership_view', 'dbo']
    );
    await queryRunner.query(`DROP VIEW "ownership_view"`);
    await queryRunner.query(`ALTER TABLE [ownership] ADD [integrationProviderId] integer`);
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT [UQ_15254869519459309bbe96ee64e] UNIQUE ([teamId], [integrationProviderId])`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT [FK_a40bf59df64995289bf17b4ed3e] FOREIGN KEY ([integrationProviderId]) REFERENCES "integration_provider"([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(`CREATE VIEW "ownership_view" AS SELECT ownership.[id],
ownership.[teamId],
ownership.[roleId],
CASE
    WHEN [ownership].[edorgId] IS NOT NULL THEN 'Edorg'
    WHEN ownership.[odsId] IS NOT NULL THEN 'Ods'
    WHEN ownership.[edfiTenantId] IS NOT NULL THEN 'EdfiTenant'
    WHEN ownership.[integrationProviderId] IS NOT NULL THEN 'IntegrationProvider'
    ELSE 'SbEnvironment' END "resourceType",
COALESCE(sb_environment.name, '') +
COALESCE(integration_provider.name, '') +
CASE WHEN edfi_tenant.[name] IS NOT NULL THEN ' / ' + edfi_tenant.[name] ELSE '' END +
CASE WHEN ods."dbName" IS NOT NULL THEN ' / ' + ods."dbName" ELSE '' END +
CASE
    WHEN edorg.[shortNameOfInstitution] IS NOT NULL THEN ' / ' + edorg.[shortNameOfInstitution]
    WHEN edorg.[nameOfInstitution] IS NOT NULL THEN ' / ' + edorg.[nameOfInstitution]
    ELSE ''
END "resourceText"
FROM ownership
  LEFT JOIN integration_provider ON ownership.[integrationProviderId] = integration_provider.id
  LEFT JOIN edorg ON ownership.[edorgId] = edorg.id
  LEFT JOIN ods ON ownership.[odsId] = ods.id OR edorg.[odsId] = ods.id
  LEFT JOIN edfi_tenant ON ownership.[edfiTenantId] = edfi_tenant.id OR ods.[edfiTenantId] = edfi_tenant.id
  LEFT JOIN sb_environment ON ownership.[sbEnvironmentId] = sb_environment.id
            OR edfi_tenant.[sbEnvironmentId] = sb_environment.id`);
    await queryRunner.query(
      `INSERT INTO [typeorm_metadata]([schema], [type], [name], "value") VALUES ($1, $2, $3,$4)`,
      [
        'dbo',
        'VIEW',
        'ownership_view',
        'SELECT ownership.[id],\nownership.[teamId],\nownership.[roleId],\nCASE\n    WHEN [ownership].[edorgId] IS NOT NULL THEN \'Edorg\'\n    WHEN ownership.[odsId] IS NOT NULL THEN \'Ods\'\n    WHEN ownership.[edfiTenantId] IS NOT NULL THEN \'EdfiTenant\'\n    WHEN ownership.[integrationProviderId] IS NOT NULL THEN \'IntegrationProvider\'\n    ELSE \'SbEnvironment\' END "resourceType",\nCOALESCE(sb_environment.name, \'\') +\nCOALESCE(integration_provider.name, \'\') +\nCASE WHEN edfi_tenant.[name] IS NOT NULL THEN \' / \' + edfi_tenant.[name] ELSE \'\' END +\nCASE WHEN ods."dbName" IS NOT NULL THEN \' / \' + ods."dbName" ELSE \'\' END +\nCASE\n    WHEN edorg.[shortNameOfInstitution] IS NOT NULL THEN \' / \' + edorg.[shortNameOfInstitution]\n    WHEN edorg.[nameOfInstitution] IS NOT NULL THEN \' / \' + edorg.[nameOfInstitution]\n    ELSE \'\'\nEND "resourceText"\nFROM ownership\n  LEFT JOIN integration_provider ON ownership.[integrationProviderId] = integration_provider.id\n  LEFT JOIN edorg ON ownership.[edorgId] = edorg.id\n  LEFT JOIN ods ON ownership.[odsId] = ods.id OR edorg.[odsId] = ods.id\n  LEFT JOIN edfi_tenant ON ownership.[edfiTenantId] = edfi_tenant.id OR ods.[edfiTenantId] = edfi_tenant.id\n  LEFT JOIN sb_environment ON ownership.[sbEnvironmentId] = sb_environment.id\n            OR edfi_tenant.[sbEnvironmentId] = sb_environment.id',
      ]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE [type] = $1 AND [name] = $2 AND "schema" = $3`,
      ['VIEW', 'ownership_view', 'dbo']
    );
    await queryRunner.query(`DROP VIEW "ownership_view"`);
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [FK_a40bf59df64995289bf17b4ed3e]`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [UQ_15254869519459309bbe96ee64e]`
    );
    await queryRunner.query(`ALTER TABLE [ownership] DROP COLUMN [integrationProviderId]`);
    await queryRunner.query(`CREATE VIEW "ownership_view" AS SELECT ownership.[id],
ownership.[teamId],
ownership.[roleId],
CASE
    WHEN [ownership].[edorgId] IS NOT NULL then 'Edorg'
    WHEN ownership.[odsId] IS NOT NULL THEN 'Ods'
    WHEN ownership.[edfiTenantId] IS NOT NULL THEN 'EdfiTenant'
    ELSE 'SbEnvironment' END "resourceType",
sb_environment.name +
CASE WHEN edfi_tenant.[name] IS NOT NULL THEN ' / ' + edfi_tenant.[name] ELSE '' END +
CASE WHEN ods."dbName" IS NOT NULL THEN ' / ' + ods."dbName" ELSE '' END +
CASE
    WHEN edorg.[shortNameOfInstitution] IS NOT NULL THEN ' / ' + edorg.[shortNameOfInstitution]
    WHEN edorg.[nameOfInstitution] IS NOT NULL THEN ' / ' + edorg.[nameOfInstitution]
    ELSE '' END              "resourceText"
FROM ownership
  LEFT JOIN edorg ON ownership.[edorgId] = edorg.id
  LEFT JOIN ods ON ownership.[odsId] = ods.id OR edorg.[odsId] = ods.id
  LEFT JOIN edfi_tenant ON ownership.[edfiTenantId] = edfi_tenant.id OR ods.[edfiTenantId] = edfi_tenant.id
  LEFT JOIN sb_environment ON ownership.[sbEnvironmentId] = sb_environment.id or
                              edfi_tenant.[sbEnvironmentId] = sb_environment.id`);
    await queryRunner.query(
      `INSERT INTO [typeorm_metadata]([schema], [type], [name], "value") VALUES ($1, $2, $3,$4)`,
      [
        'dbo',
        'VIEW',
        'ownership_view',
        'SELECT ownership.[id],\nownership.[teamId],\nownership.[roleId],\nCASE\n    WHEN [ownership].[edorgId] IS NOT NULL then \'Edorg\'\n    WHEN ownership.[odsId] IS NOT NULL THEN \'Ods\'\n    WHEN ownership.[edfiTenantId] IS NOT NULL THEN \'EdfiTenant\'\n    ELSE \'SbEnvironment\' END "resourceType",\nsb_environment.name +\nCASE WHEN edfi_tenant.[name] IS NOT NULL THEN \' / \' + edfi_tenant.[name] ELSE \'\' END +\nCASE WHEN ods."dbName" IS NOT NULL THEN \' / \' + ods."dbName" ELSE \'\' END +\nCASE\n    WHEN edorg.[shortNameOfInstitution] IS NOT NULL THEN \' / \' + edorg.[shortNameOfInstitution]\n    WHEN edorg.[nameOfInstitution] IS NOT NULL THEN \' / \' + edorg.[nameOfInstitution]\n    ELSE \'\' END              "resourceText"\nFROM ownership\n  LEFT JOIN edorg ON ownership.[edorgId] = edorg.id\n  LEFT JOIN ods ON ownership.[odsId] = ods.id OR edorg.[odsId] = ods.id\n  LEFT JOIN edfi_tenant ON ownership.[edfiTenantId] = edfi_tenant.id OR ods.[edfiTenantId] = edfi_tenant.id\n  LEFT JOIN sb_environment ON ownership.[sbEnvironmentId] = sb_environment.id or\n                              edfi_tenant.[sbEnvironmentId] = sb_environment.id',
      ]
    );
  }
}
