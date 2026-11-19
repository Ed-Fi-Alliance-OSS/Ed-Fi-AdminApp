import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AC-660: global admins review certification runs.
 *
 * `submittedAt` is when the vendor sent the run to review; unlike `statusChangedAt` it survives
 * the pick-up. Runs already in review are backfilled from `statusChangedAt`.
 * `certification_run_comment` keeps one row per review decision, with the reviewer's comment.
 */
export class CertificationReview1794000000005 implements MigrationInterface {
  name = 'CertificationReview1794000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cert"."certification_run" ADD COLUMN "submittedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `UPDATE "cert"."certification_run" SET "submittedAt" = "statusChangedAt" WHERE "status" IN ('READY_FOR_REVIEW', 'READY_FOR_REVIEW_WITH_CHANGES', 'IN_REVIEW')`,
    );

    await queryRunner.query(`
      CREATE TABLE "cert"."certification_run_comment" (
        "certificationRunCommentId" SERIAL NOT NULL,
        "certificationRunId"        integer NOT NULL,
        "authorId"                  integer,
        "decision"                  character varying(50) NOT NULL,
        "text"                      text,
        "createdAt"                 TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cert_certification_run_comment" PRIMARY KEY ("certificationRunCommentId"),
        CONSTRAINT "FK_cert_certification_run_comment_run"
          FOREIGN KEY ("certificationRunId")
          REFERENCES "cert"."certification_run"("certificationRunId") ON DELETE CASCADE,
        CONSTRAINT "FK_cert_certification_run_comment_author"
          FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_cert_certification_run_comment_run" ON "cert"."certification_run_comment" ("certificationRunId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "cert"."IDX_cert_certification_run_comment_run"`);
    await queryRunner.query(`DROP TABLE "cert"."certification_run_comment"`);
    await queryRunner.query(`ALTER TABLE "cert"."certification_run" DROP COLUMN "submittedAt"`);
  }
}
