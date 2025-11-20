import { MigrationInterface, QueryRunner } from 'typeorm';

export class NullableEnvlabel1693335908870 implements MigrationInterface {
  name = 'NullableEnvlabel1693335908870';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sbe" ALTER COLUMN "envLabel" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sbe" ALTER COLUMN "envLabel" SET NOT NULL`);
  }
}
