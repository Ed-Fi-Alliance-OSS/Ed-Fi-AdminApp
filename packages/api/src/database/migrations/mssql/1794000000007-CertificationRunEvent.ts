import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AC-650: append-only audit history of a certification run (see the pgsql twin).
 *
 * `certificationRunCommentId` has no FK: a comment is only ever deleted with its run, and the
 * run -> comment and run -> event cascades plus an event -> comment FK would make a diamond that
 * can make SQL Server refuse to delete a reviewed run.
 */
export class CertificationRunEvent1794000000007 implements MigrationInterface {
  name = 'CertificationRunEvent1794000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE [cert].[certification_run_event] (
        [certificationRunEventId]   INT IDENTITY(1,1) NOT NULL,
        [certificationRunId]        INT NOT NULL,
        [event]                     NVARCHAR(50) NOT NULL,
        [fromStatus]                NVARCHAR(50) NULL,
        [toStatus]                  NVARCHAR(50) NOT NULL,
        [catalogVersionId]          INT NULL,
        [userId]                    INT NULL,
        [certificationRunCommentId] INT NULL,
        [createdAt]                 datetime2 NOT NULL DEFAULT getdate(),
        CONSTRAINT [PK_cert_certification_run_event] PRIMARY KEY ([certificationRunEventId]),
        CONSTRAINT [FK_cert_certification_run_event_run]
          FOREIGN KEY ([certificationRunId])
          REFERENCES [cert].[certification_run]([certificationRunId]) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX [IDX_cert_certification_run_event_run] ON [cert].[certification_run_event] ([certificationRunId], [certificationRunEventId])`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX [IDX_cert_certification_run_event_run] ON [cert].[certification_run_event]`,
    );
    await queryRunner.query(`DROP TABLE [cert].[certification_run_event]`);
  }
}
