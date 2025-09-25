import { MigrationInterface, QueryRunner } from 'typeorm';

export class GuaranteeMembershipUniqueness1691694310950 implements MigrationInterface {
  name = 'GuaranteeMembershipUniqueness1691694310950';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_tenant_membership" ADD CONSTRAINT "UQ_9f362212436320884321873e1fd" UNIQUE ("tenantId", "userId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_tenant_membership" DROP CONSTRAINT "UQ_9f362212436320884321873e1fd"`
    );
  }
}
