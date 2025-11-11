import { Edorg } from '@edanalytics/models-server';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdOdsNaturalKeyToEdorg1687466013005 implements MigrationInterface {
  name = 'AdOdsNaturalKeyToEdorg1687466013005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE [edorg] ADD [odsDbName] NVARCHAR(MAX)`);
    await queryRunner.query(
      `ALTER TABLE [edorg] ADD CONSTRAINT [UQ_07c5479767d3c27eb0150fee1d9] UNIQUE ([sbeId], [odsId], [educationOrganizationId])`
    );
    await queryRunner.query(
      `UPDATE e SET [odsDbName] = o.[dbName] FROM [edorg] e INNER JOIN [ods] o ON e.[odsId] = o.[id]`
    );
    await queryRunner.query('ALTER TABLE [edorg] ALTER COLUMN [odsDbName] NVARCHAR(MAX) NOT NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE [edorg] DROP CONSTRAINT [UQ_07c5479767d3c27eb0150fee1d9]`);
  await queryRunner.query(`ALTER TABLE [edorg] DROP COLUMN [odsDbName]`);
  }
}
