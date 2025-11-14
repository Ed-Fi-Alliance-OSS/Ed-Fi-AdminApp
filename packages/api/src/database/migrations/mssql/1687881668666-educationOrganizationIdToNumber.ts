import { MigrationInterface, QueryRunner } from 'typeorm';

export class EducationOrganizationIdToNumber1687881668666 implements MigrationInterface {
  name = 'EducationOrganizationIdToNumber1687881668666';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE [edorg] DROP CONSTRAINT [UQ_07c5479767d3c27eb0150fee1d9]`);
    await queryRunner.query(
      `ALTER TABLE [edorg] ALTER COLUMN [educationOrganizationId] INT`
    );
    await queryRunner.query(
      `ALTER TABLE [edorg] ADD CONSTRAINT [UQ_07c5479767d3c27eb0150fee1d9] UNIQUE ([sbeId], [odsId], [educationOrganizationId])`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE [edorg] ALTER COLUMN [educationOrganizationId] NVARCHAR(MAX)`
    );
    await queryRunner.query(
      `ALTER TABLE [edorg] ADD CONSTRAINT [UQ_07c5479767d3c27eb0150fee1d9] UNIQUE ([sbeId], [odsId], [educationOrganizationId])`
    );
  }
}
