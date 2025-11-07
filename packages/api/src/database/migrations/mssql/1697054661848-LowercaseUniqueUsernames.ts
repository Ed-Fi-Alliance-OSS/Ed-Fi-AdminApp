import { MigrationInterface, QueryRunner } from 'typeorm';

export class LowercaseUniqueUsernames1697054661848 implements MigrationInterface {
  name = 'LowercaseUniqueUsernames1697054661848';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS citext');
    await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "username" TYPE citext`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_78a916df40e02a9deb1c4b75ed" ON "user" ("username")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_78a916df40e02a9deb1c4b75ed"`);
    await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "username" TYPE character varying`);
  }
}
