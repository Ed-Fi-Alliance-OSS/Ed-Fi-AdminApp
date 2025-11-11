import { MigrationInterface, QueryRunner } from 'typeorm';

export class OdsInstanceName1710454017707 implements MigrationInterface {
  name = 'OdsInstanceName1710454017707';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE [ods] ADD [odsInstanceName] character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE [ods] DROP COLUMN [odsInstanceName]`);
  }
}
