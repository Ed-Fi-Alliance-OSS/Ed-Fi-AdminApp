import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Kept separate because the run/domain migrations were already applied in development
 * before uppercase statuses were requested. Preserve those existing runs and results.
 */
export class UppercaseCertificationRunStatuses1794000000002 implements MigrationInterface {
  name = 'UppercaseCertificationRunStatuses1794000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.setStatusCase(queryRunner, true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.setStatusCase(queryRunner, false);
  }

  private async setStatusCase(queryRunner: QueryRunner, upper: boolean): Promise<void> {
    // Drop both indexes first: converting closed runs would otherwise make them count as open.
    await queryRunner.query(`DROP INDEX "cert"."UQ_cert_certification_run_open_ods"`);
    await queryRunner.query(`DROP INDEX "cert"."UQ_cert_certification_run_open_no_ods"`);
    await queryRunner.query(
      `UPDATE "cert"."certification_run" SET "status" = ${upper ? 'UPPER' : 'LOWER'}("status")`,
    );
    const approved = upper ? 'APPROVED' : 'approved';
    const rejected = upper ? 'REJECTED' : 'rejected';
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_cert_certification_run_open_ods"
        ON "cert"."certification_run" ("edfiTenantId", "odsId", "certificationModel")
        WHERE "odsId" IS NOT NULL AND "status" NOT IN ('${approved}', '${rejected}')
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_cert_certification_run_open_no_ods"
        ON "cert"."certification_run" ("edfiTenantId", "certificationModel")
        WHERE "odsId" IS NULL AND "status" NOT IN ('${approved}', '${rejected}')
    `);
  }
}
