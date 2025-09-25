import { Edorg } from '@edanalytics/models-server';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdOdsNaturalKeyToEdorg1687466013005 implements MigrationInterface {
  name = 'AdOdsNaturalKeyToEdorg1687466013005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "edorg" ADD "odsDbName" character varying`);
    await queryRunner.query(
      `ALTER TABLE "edorg" ADD CONSTRAINT "UQ_07c5479767d3c27eb0150fee1d9" UNIQUE ("sbeId", "odsId", "educationOrganizationId")`
    );
    await queryRunner.query(
      `UPDATE edorg SET "odsDbName" = ods."dbName" FROM ods WHERE edorg."odsId" = ods."id"`
    );
    await queryRunner.query('ALTER TABLE "edorg" ALTER COLUMN "odsDbName" SET NOT NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "edorg" DROP CONSTRAINT "UQ_07c5479767d3c27eb0150fee1d9"`);
    await queryRunner.query(`ALTER TABLE "edorg" DROP COLUMN "odsDbName"`);
  }
}
