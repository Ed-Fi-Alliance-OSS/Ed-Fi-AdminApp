import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueClientId1747424374434 implements MigrationInterface {
  name = 'UniqueClientId1747424374434';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // In PostgreSQL, two null values are never "the same", therefore a unique
    // index can have multiple rows with a null value. But SQL server does treat
    // them as "the same", and therefore prevents having multiple nulls. But a
    // filtered index allows us to ignore nulls and get the same result as in
    // PostgreSQL.
    await queryRunner
      .query(
        `CREATE UNIQUE INDEX [IDX_56f28841fe433cf13f8685f9bc] ON [user] ([clientId]) WHERE [clientId] IS NOT NULL`
      )
      .catch((error) => {
        console.error(
          '\nError creating UNIQUE index on clientId. Check for existing duplicates.\n'
        );
        throw error;
      });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX [IDX_56f28841fe433cf13f8685f9bc] ON [user]`);
  }
}
