import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AC-650: append-only audit history of a certification run.
 *
 * `userId` deliberately has no FK to "user", so a deleted user's entries never change.
 * Entries go away only with their run (ON DELETE CASCADE).
 */
export class CertificationRunEvent1794000000007 implements MigrationInterface {
  name = 'CertificationRunEvent1794000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "cert"."certification_run_event" (
        "certificationRunEventId"   SERIAL NOT NULL,
        "certificationRunId"        integer NOT NULL,
        "event"                     character varying(50) NOT NULL,
        "fromStatus"                character varying(50),
        "toStatus"                  character varying(50) NOT NULL,
        "catalogVersionId"          integer,
        "userId"                    integer,
        "certificationRunCommentId" integer,
        "createdAt"                 TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cert_certification_run_event" PRIMARY KEY ("certificationRunEventId"),
        CONSTRAINT "FK_cert_certification_run_event_run"
          FOREIGN KEY ("certificationRunId")
          REFERENCES "cert"."certification_run"("certificationRunId") ON DELETE CASCADE,
        CONSTRAINT "FK_cert_certification_run_event_comment"
          FOREIGN KEY ("certificationRunCommentId")
          REFERENCES "cert"."certification_run_comment"("certificationRunCommentId") ON DELETE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_cert_certification_run_event_run" ON "cert"."certification_run_event" ("certificationRunId", "certificationRunEventId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "cert"."IDX_cert_certification_run_event_run"`);
    await queryRunner.query(`DROP TABLE "cert"."certification_run_event"`);
  }
}
