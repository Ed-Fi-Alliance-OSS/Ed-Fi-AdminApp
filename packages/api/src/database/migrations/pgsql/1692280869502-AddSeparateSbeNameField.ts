import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSeparateSbeNameField1692280869502 implements MigrationInterface {
  name = 'AddSeparateSbeNameField1692280869502';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sbe" ADD "name" character varying`);
    await queryRunner.query(`UPDATE "sbe" SET "name" = "envLabel"`);
    await queryRunner.query(`ALTER TABLE "sbe" ALTER COLUMN "name" SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sbe" DROP COLUMN "name"`);
  }
}
