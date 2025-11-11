import { MigrationInterface, QueryRunner } from 'typeorm';

export class EdorgShortname1689282856860 implements MigrationInterface {
  name = 'EdorgShortname1689282856860';

  public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE [edorg] ADD [shortNameOfInstitution] NVARCHAR(MAX)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE [edorg] DROP COLUMN [shortNameOfInstitution]`);
  }
}
