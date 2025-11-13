import { MigrationInterface, QueryRunner } from 'typeorm';

export class EducationOrganizationIdToNumber1687881668666 implements MigrationInterface {
  name = 'EducationOrganizationIdToNumber1687881668666';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE [edorg] ALTER COLUMN [educationOrganizationId] INT`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE [edorg] ALTER COLUMN [educationOrganizationId] NVARCHAR(MAX)`
    );
  }
}
