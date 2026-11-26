import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AC-650: append-only audit history of a certification run.
 *
 * `userId` deliberately has no FK to "user", so a deleted user's entries never change.
 * `certificationRunCommentId` has no FK either: a comment is only ever deleted with its run, and
 * on SQL Server the run -> comment and run -> event cascades plus an event -> comment FK would make
 * a diamond that can make deleting a reviewed run fail (see the mssql twin).
 * Entries go away only with their run (ON DELETE CASCADE).
 * Append-only is enforced in code, not here: the ticket rules out triggers, and revoking
 * UPDATE/DELETE from the app role would also block the cascade from the run.
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
          REFERENCES "cert"."certification_run"("certificationRunId") ON DELETE CASCADE
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
