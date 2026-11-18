import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AC-672: records when a certification run entered its current status, so the dashboard can show
 * how long a run has been waiting. `updatedAt` changes on any update and cannot answer that.
 * Existing rows are backfilled from `updatedAt`.
 */
export class AddCertificationRunStatusChangedAt1794000000003 implements MigrationInterface {
  name = 'AddCertificationRunStatusChangedAt1794000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE [cert].[certification_run] ADD [statusChangedAt] datetime2 NOT NULL CONSTRAINT [DF_cert_certification_run_statusChangedAt] DEFAULT getdate()`,
    );
    await queryRunner.query(
      `UPDATE [cert].[certification_run] SET [statusChangedAt] = [updatedAt]`,
    );
    await queryRunner.query(
      `CREATE INDEX [IDX_cert_certification_run_status_changed] ON [cert].[certification_run] ([status], [statusChangedAt])`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX [IDX_cert_certification_run_status_changed] ON [cert].[certification_run]`,
    );
    await queryRunner.query(
      `ALTER TABLE [cert].[certification_run] DROP CONSTRAINT [DF_cert_certification_run_statusChangedAt]`,
    );
    await queryRunner.query(`ALTER TABLE [cert].[certification_run] DROP COLUMN [statusChangedAt]`);
  }
}
