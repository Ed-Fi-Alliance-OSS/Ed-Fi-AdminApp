import { MigrationInterface, QueryRunner } from 'typeorm';

export class LowercaseUniqueUsernames1697054661848 implements MigrationInterface {
  name = 'LowercaseUniqueUsernames1697054661848';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The PostgreSQL version changes the [username] data type to a case
    // insensitive string. This is the default situation in MSSQL, therefore
    // there is no need to change the data type.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_78a916df40e02a9deb1c4b75ed" ON [user] ([username])`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX [IDX_78a916df40e02a9deb1c4b75ed] ON [user]`);
  }
}
