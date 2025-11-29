import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfilePrivileges1719427712090 implements MigrationInterface {
  name = 'AddProfilePrivileges1719427712090';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add profile privileges to Tenant admin role (ID 6)
    // For simple-array, append privileges if not already present
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0 THEN [privilegeIds] + ',team.sb-environment.edfi-tenant.profile:read' ELSE 'team.sb-environment.edfi-tenant.profile:read' END WHERE id = 6 AND [privilegeIds] NOT LIKE '%team.sb-environment.edfi-tenant.profile:read%'`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0 THEN [privilegeIds] + ',team.sb-environment.edfi-tenant.profile:update' ELSE 'team.sb-environment.edfi-tenant.profile:update' END WHERE id = 6 AND [privilegeIds] NOT LIKE '%team.sb-environment.edfi-tenant.profile:update%'`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0 THEN [privilegeIds] + ',team.sb-environment.edfi-tenant.profile:delete' ELSE 'team.sb-environment.edfi-tenant.profile:delete' END WHERE id = 6 AND [privilegeIds] NOT LIKE '%team.sb-environment.edfi-tenant.profile:delete%'`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0 THEN [privilegeIds] + ',team.sb-environment.edfi-tenant.profile:create' ELSE 'team.sb-environment.edfi-tenant.profile:create' END WHERE id = 6 AND [privilegeIds] NOT LIKE '%team.sb-environment.edfi-tenant.profile:create%'`
    );

    // Add profile privileges to Full ownership role (ID 5)
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0 THEN [privilegeIds] + ',team.sb-environment.edfi-tenant.profile:read' ELSE 'team.sb-environment.edfi-tenant.profile:read' END WHERE id = 5 AND [privilegeIds] NOT LIKE '%team.sb-environment.edfi-tenant.profile:read%'`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0 THEN [privilegeIds] + ',team.sb-environment.edfi-tenant.profile:update' ELSE 'team.sb-environment.edfi-tenant.profile:update' END WHERE id = 5 AND [privilegeIds] NOT LIKE '%team.sb-environment.edfi-tenant.profile:update%'`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0 THEN [privilegeIds] + ',team.sb-environment.edfi-tenant.profile:delete' ELSE 'team.sb-environment.edfi-tenant.profile:delete' END WHERE id = 5 AND [privilegeIds] NOT LIKE '%team.sb-environment.edfi-tenant.profile:delete%'`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0 THEN [privilegeIds] + ',team.sb-environment.edfi-tenant.profile:create' ELSE 'team.sb-environment.edfi-tenant.profile:create' END WHERE id = 5 AND [privilegeIds] NOT LIKE '%team.sb-environment.edfi-tenant.profile:create%'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove profile privileges from Tenant admin role (ID 6)
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',team.sb-environment.edfi-tenant.profile:read,', ',') WHERE id = 6`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',team.sb-environment.edfi-tenant.profile:update,', ',') WHERE id = 6`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',team.sb-environment.edfi-tenant.profile:delete,', ',') WHERE id = 6`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',team.sb-environment.edfi-tenant.profile:create,', ',') WHERE id = 6`
    );

    // Remove profile privileges from Full ownership role (ID 5)
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',team.sb-environment.edfi-tenant.profile:read,', ',') WHERE id = 5`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',team.sb-environment.edfi-tenant.profile:update,', ',') WHERE id = 5`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',team.sb-environment.edfi-tenant.profile:delete,', ',') WHERE id = 5`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',team.sb-environment.edfi-tenant.profile:create,', ',') WHERE id = 5`
    );
    
    // Clean up leading/trailing commas
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = TRIM(',' FROM [privilegeIds]) WHERE id IN (5, 6)`
    );
  }
}
