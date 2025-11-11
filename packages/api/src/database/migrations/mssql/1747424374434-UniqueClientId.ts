import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueClientId1747424374434 implements MigrationInterface {
  name = 'UniqueClientId1747424374434';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner
      .query(`CREATE UNIQUE INDEX "IDX_56f28841fe433cf13f8685f9bc" ON [user] ([clientId]) `)
      .catch((error) => {
        console.error(
          '\nError creating UNIQUE index on clientId. Check for existing duplicates.\n'
        );
        throw error;
      });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "dbo"."IDX_56f28841fe433cf13f8685f9bc"`);
  }
}
