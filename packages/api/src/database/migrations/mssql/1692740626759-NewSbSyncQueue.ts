import { MigrationInterface, QueryRunner } from 'typeorm';

export class NewSbSyncQueue1692740626759 implements MigrationInterface {
  name = 'NewSbSyncQueue1692740626759';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO [privilege] ([name], [description], [code]) VALUES ('sb-sync-queue:read', 'Read SB sync queue in the global scope.', 'sb-sync-queue:read'), ('sb-sync-queue:archive', 'Archive SB sync queue in the global scope.', 'sb-sync-queue:archive')`
    );
    // Note: pgboss is PostgreSQL-specific and not supported on MSSQL.
    // The sb_sync_queue view is skipped for MSSQL as pgboss requires PostgreSQL.
    // If background job functionality is needed on MSSQL, an alternative queue system must be implemented.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM [privilege] WHERE [code] in ('sb-sync-queue:read', 'sb-sync-queue:archive')`
    );
    // No view to drop on MSSQL since pgboss is PostgreSQL-only
  }
}
