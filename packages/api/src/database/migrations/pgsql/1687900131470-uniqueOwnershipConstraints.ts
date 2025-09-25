import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueOwnershipConstraints1687900131470 implements MigrationInterface {
  name = 'UniqueOwnershipConstraints1687900131470';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "UQ_e81f6591816838e021ba3a4e110" UNIQUE ("tenantId", "edorgId")`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "UQ_4f9d354f38493a53dd7b1a1b96e" UNIQUE ("tenantId", "odsId")`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "UQ_03fd4f242cf59f808f69df949a1" UNIQUE ("tenantId", "sbeId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "UQ_03fd4f242cf59f808f69df949a1"`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "UQ_4f9d354f38493a53dd7b1a1b96e"`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "UQ_e81f6591816838e021ba3a4e110"`
    );
  }
}
