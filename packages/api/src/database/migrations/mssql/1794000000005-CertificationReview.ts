import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AC-660: global admins review certification runs (see the pgsql twin).
 *
 * The author FK uses NO ACTION, as createdById does in CertificationRuns1794000000000: the
 * comment already cascades from its run, and SQL Server rejects a second cascade path.
 */
export class CertificationReview1794000000005 implements MigrationInterface {
  name = 'CertificationReview1794000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE [cert].[certification_run] ADD [submittedAt] datetime2 NULL`,
    );
    await queryRunner.query(
      `UPDATE [cert].[certification_run] SET [submittedAt] = [statusChangedAt] WHERE [status] IN ('READY_FOR_REVIEW', 'READY_FOR_REVIEW_WITH_CHANGES', 'IN_REVIEW')`,
    );

    await queryRunner.query(`
      CREATE TABLE [cert].[certification_run_comment] (
        [certificationRunCommentId] INT IDENTITY(1,1) NOT NULL,
        [certificationRunId]        INT NOT NULL,
        [authorId]                  INT NULL,
        [decision]                  NVARCHAR(50) NOT NULL,
        [text]                      NVARCHAR(max) NULL,
        [createdAt]                 datetime2 NOT NULL DEFAULT getdate(),
        CONSTRAINT [PK_cert_certification_run_comment] PRIMARY KEY ([certificationRunCommentId]),
        CONSTRAINT [FK_cert_certification_run_comment_run]
          FOREIGN KEY ([certificationRunId])
          REFERENCES [cert].[certification_run]([certificationRunId]) ON DELETE CASCADE,
        CONSTRAINT [FK_cert_certification_run_comment_author]
          FOREIGN KEY ([authorId]) REFERENCES [user]([id]) ON DELETE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX [IDX_cert_certification_run_comment_run] ON [cert].[certification_run_comment] ([certificationRunId])`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX [IDX_cert_certification_run_comment_run] ON [cert].[certification_run_comment]`,
    );
    await queryRunner.query(`DROP TABLE [cert].[certification_run_comment]`);
    await queryRunner.query(`ALTER TABLE [cert].[certification_run] DROP COLUMN [submittedAt]`);
  }
}
