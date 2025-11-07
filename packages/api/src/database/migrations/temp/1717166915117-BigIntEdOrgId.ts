import { MigrationInterface, QueryRunner } from 'typeorm';

export class BigIntEdOrg1717166915117 implements MigrationInterface {
  name = 'BigIntEdOrg1717166915117';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "edorg" ALTER COLUMN "educationOrganizationId" TYPE bigint`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "edorg" ALTER COLUMN "educationOrganizationId" TYPE integer`
    );
  }
}
