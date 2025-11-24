import { MigrationInterface, QueryRunner } from 'typeorm';

export class SbeConfigReorg1687190483472 implements MigrationInterface {
  name = 'SbeConfigReorg1687190483472';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sbe" DROP COLUMN "configPublic"`);
    await queryRunner.query(`ALTER TABLE "sbe" ADD "configPublic" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    throw new Error(
      'No "down" migration for sbe-config-reorg. This migration was created to prove out the migrations system, but there is no down method because we are still pre-production and there is no need for such frivolous things.'
    );
  }
}
