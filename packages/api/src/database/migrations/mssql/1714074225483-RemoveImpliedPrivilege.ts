import { MigrationInterface, QueryRunner } from 'typeorm';

/* This privilege has always really been baked into app logic and never should have been a true dynamic privilege.
  The same is more or less true of me:read as well, but it would be a bigger deal to remove and we can do it later.
  */

export class RemoveImpliedPrivilege1714074225483 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // For simple-array (comma-separated string), remove 'privilege:read' from the list
    queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',privilege:read,', ',') WHERE [privilegeIds] LIKE '%privilege:read%'`
    );
    // Clean up leading/trailing commas
    queryRunner.query(`UPDATE [role] SET [privilegeIds] = TRIM(',' FROM [privilegeIds])`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // For simple-array, append 'privilege:read' if not already present
    queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0 THEN [privilegeIds] + ',privilege:read' ELSE 'privilege:read' END WHERE [privilegeIds] NOT LIKE '%privilege:read%'`
    );
  }
}
