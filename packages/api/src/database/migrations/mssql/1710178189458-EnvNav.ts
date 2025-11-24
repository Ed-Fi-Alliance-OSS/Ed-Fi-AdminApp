import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnvNav1710178189458 implements MigrationInterface {
  name = 'EnvNav1710178189458';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Note: pgboss materialized view skipped for MSSQL (PostgreSQL-only feature)
    // MSSQL doesn't support materialized views natively

    // Create env_nav view with MSSQL syntax
    await queryRunner.query(`CREATE VIEW [env_nav] AS
  select [name] [sbEnvironmentName], [id] [sbEnvironmentId], null [edfiTenantName], null [edfiTenantId]
from sb_environment
union
select sb_environment.[name],
       sb_environment.[id],
       edfi_tenant.[name],
       edfi_tenant.[id]
from sb_environment
         right join edfi_tenant on sb_environment.id = edfi_tenant.[sbEnvironmentId]`);
    await queryRunner.query(
      `INSERT INTO [typeorm_metadata]([schema], [type], [name], [value]) VALUES ($1, $2, $3, $4)`,
      [
        'dbo',
        'VIEW',
        'env_nav',
        'select [name] [sbEnvironmentName], [id] [sbEnvironmentId], null [edfiTenantName], null [edfiTenantId]\nfrom sb_environment\nunion\nselect sb_environment.[name],\n       sb_environment.[id],\n       edfi_tenant.[name],\n       edfi_tenant.[id]\nfrom sb_environment\n         right join edfi_tenant on sb_environment.id = edfi_tenant.[sbEnvironmentId]',
      ]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM [typeorm_metadata] WHERE [type] = $1 AND [name] = $2 AND [schema] = $3`,
      ['VIEW', 'env_nav', 'dbo']
    );
    await queryRunner.query(`DROP VIEW [env_nav]`);
  }
}
