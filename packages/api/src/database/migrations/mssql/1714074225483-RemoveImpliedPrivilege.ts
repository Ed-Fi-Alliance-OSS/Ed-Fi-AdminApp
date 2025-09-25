import { MigrationInterface, QueryRunner } from 'typeorm';

/* This privilege has always really been baked into app logic and never should have been a true dynamic privilege.
  The same is more or less true of me:read as well, but it would be a bigger deal to remove and we can do it later.
  */

export class RemoveImpliedPrivilege1714074225483 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      `UPDATE role set "privilegeIds" = array_remove("privilegeIds", 'privilege:read')`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      `UPDATE role set "privilegeIds" = array_append("privilegeIds", 'privilege:read')`
    );
  }
}
