import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfilePrivileges1719427712090 implements MigrationInterface {
  name = 'AddProfilePrivileges1719427712090';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add profile privileges to Tenant admin role (ID 6)
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_append("privilegeIds", 'team.sb-environment.edfi-tenant.profile:read') WHERE id = 6 AND NOT ('team.sb-environment.edfi-tenant.profile:read' = ANY("privilegeIds"))`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_append("privilegeIds", 'team.sb-environment.edfi-tenant.profile:update') WHERE id = 6 AND NOT ('team.sb-environment.edfi-tenant.profile:update' = ANY("privilegeIds"))`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_append("privilegeIds", 'team.sb-environment.edfi-tenant.profile:delete') WHERE id = 6 AND NOT ('team.sb-environment.edfi-tenant.profile:delete' = ANY("privilegeIds"))`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_append("privilegeIds", 'team.sb-environment.edfi-tenant.profile:create') WHERE id = 6 AND NOT ('team.sb-environment.edfi-tenant.profile:create' = ANY("privilegeIds"))`
    );

    // Add profile privileges to Full ownership role (ID 5)
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_append("privilegeIds", 'team.sb-environment.edfi-tenant.profile:read') WHERE id = 5 AND NOT ('team.sb-environment.edfi-tenant.profile:read' = ANY("privilegeIds"))`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_append("privilegeIds", 'team.sb-environment.edfi-tenant.profile:update') WHERE id = 5 AND NOT ('team.sb-environment.edfi-tenant.profile:update' = ANY("privilegeIds"))`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_append("privilegeIds", 'team.sb-environment.edfi-tenant.profile:delete') WHERE id = 5 AND NOT ('team.sb-environment.edfi-tenant.profile:delete' = ANY("privilegeIds"))`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_append("privilegeIds", 'team.sb-environment.edfi-tenant.profile:create') WHERE id = 5 AND NOT ('team.sb-environment.edfi-tenant.profile:create' = ANY("privilegeIds"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove profile privileges from Tenant admin role (ID 6)
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_remove("privilegeIds", 'team.sb-environment.edfi-tenant.profile:read') WHERE id = 6`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_remove("privilegeIds", 'team.sb-environment.edfi-tenant.profile:update') WHERE id = 6`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_remove("privilegeIds", 'team.sb-environment.edfi-tenant.profile:delete') WHERE id = 6`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_remove("privilegeIds", 'team.sb-environment.edfi-tenant.profile:create') WHERE id = 6`
    );

    // Remove profile privileges from Full ownership role (ID 5)
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_remove("privilegeIds", 'team.sb-environment.edfi-tenant.profile:read') WHERE id = 5`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_remove("privilegeIds", 'team.sb-environment.edfi-tenant.profile:update') WHERE id = 5`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_remove("privilegeIds", 'team.sb-environment.edfi-tenant.profile:delete') WHERE id = 5`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_remove("privilegeIds", 'team.sb-environment.edfi-tenant.profile:create') WHERE id = 5`
    );
  }
}
