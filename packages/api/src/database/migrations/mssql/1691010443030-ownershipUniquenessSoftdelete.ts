import { MigrationInterface, QueryRunner } from 'typeorm';

export class OwnershipUniquenessSoftdelete1691010443030 implements MigrationInterface {
  name = 'OwnershipUniquenessSoftdelete1691010443030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [UQ_e81f6591816838e021ba3a4e110]`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [UQ_4f9d354f38493a53dd7b1a1b96e]`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [UQ_03fd4f242cf59f808f69df949a1]`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT [UQ_381c84f400fe4380394f7a410a7] UNIQUE ([tenantId], [edorgId], [deleted])`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT [UQ_c17a51e3854b3e05c8edfb0d3c8] UNIQUE ([tenantId], [odsId], [deleted])`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT [UQ_14d955adf701aad1310e1342370] UNIQUE ([tenantId], [sbeId], [deleted])`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [UQ_14d955adf701aad1310e1342370]`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [UQ_c17a51e3854b3e05c8edfb0d3c8]`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [UQ_381c84f400fe4380394f7a410a7]`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT [UQ_03fd4f242cf59f808f69df949a1] UNIQUE ([tenantId], [sbeId])`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "UQ_4f9d354f38493a53dd7b1a1b96e" UNIQUE ("tenantId", "odsId")`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "UQ_e81f6591816838e021ba3a4e110" UNIQUE ("tenantId", "edorgId")`
    );
  }
}
