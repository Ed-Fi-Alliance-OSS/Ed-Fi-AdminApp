import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMachineUserColumns1742186909224 implements MigrationInterface {
  name = 'AddMachineUserColumns1742186909224';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "dbo"."user_usertype_enum" AS ENUM('human', 'machine')`
    );
    await queryRunner.query(
      `ALTER TABLE [user] ADD "userType" "dbo"."user_usertype_enum" NOT NULL DEFAULT 'human'`
    );
    await queryRunner.query(`ALTER TABLE [user] ADD [clientId] character varying`);
    await queryRunner.query(`ALTER TABLE [user] ADD [description] character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE [user] DROP COLUMN "userType"`);
    await queryRunner.query(`DROP TYPE "dbo"."user_usertype_enum"`);
    await queryRunner.query(`ALTER TABLE [user] DROP COLUMN [description]`);
    await queryRunner.query(`ALTER TABLE [user] DROP COLUMN [clientId]`);
  }
}
