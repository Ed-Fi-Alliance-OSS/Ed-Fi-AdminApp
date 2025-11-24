import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDetailedIntegrationAppsView1745533840578 implements MigrationInterface {
  name = 'CreateDetailedIntegrationAppsView1745533840578';

  public async up(queryRunner: QueryRunner): Promise<void> {
  	// TODO: manually verify this strange syntax compared to the PostgreSQL version with its ANY() function
    await queryRunner.query(`CREATE VIEW [integration_apps_view] AS
    SELECT
      ia.*,
      et.[name] AS [edfiTenantName],
      ip.[name] AS [integrationProviderName],
      (
        SELECT STRING_AGG(e.[nameOfInstitution], ',')
        FROM edorg e
        WHERE ',' + ia.[edorgIds] + ',' LIKE '%,' + CAST(e.id AS VARCHAR) + ',%'
      ) AS [edorgNames],
      ods.[odsInstanceName] AS [odsName],
      sbe.[name] AS [sbEnvironmentName]
    FROM integration_app ia
    LEFT JOIN edfi_tenant et ON et.id = ia.[edfiTenantId]
    LEFT JOIN integration_provider ip ON ip.id = ia.[integrationProviderId]
    LEFT JOIN ods ON ods.id = ia.[odsId]
    LEFT JOIN sb_environment sbe ON sbe.id = ia.[sbEnvironmentId]
  `);
    await queryRunner.query(
      `INSERT INTO [typeorm_metadata]([schema], [type], [name], [value]) VALUES ($1, $2, $3, $4)`,
      [
        'dbo',
        'VIEW',
        'integration_apps_view',
        'SELECT\n      ia.*,\n      et.[name] AS [edfiTenantName],\n      ip.[name] AS [integrationProviderName],\n      (\n        SELECT STRING_AGG(e.[nameOfInstitution], \',\')\n        FROM edorg e\n        WHERE \',\' + ia.[edorgIds] + \',\' LIKE \'%,\' + CAST(e.id AS VARCHAR) + \',%\'\n      ) AS [edorgNames],\n      ods.[odsInstanceName] AS [odsName],\n      sbe.[name] AS [sbEnvironmentName]\n    FROM integration_app ia\n    LEFT JOIN edfi_tenant et ON et.id = ia.[edfiTenantId]\n    LEFT JOIN integration_provider ip ON ip.id = ia.[integrationProviderId]\n    LEFT JOIN ods ON ods.id = ia.[odsId]\n    LEFT JOIN sb_environment sbe ON sbe.id = ia.[sbEnvironmentId]',
      ]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM [typeorm_metadata] WHERE [type] = $1 AND [name] = $2 AND [schema] = $3`,
      ['VIEW', 'integration_apps_view', 'dbo']
    );
    await queryRunner.query(`DROP VIEW [integration_apps_view]`);
  }
}
