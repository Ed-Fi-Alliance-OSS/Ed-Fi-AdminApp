import { MigrationInterface, QueryRunner } from 'typeorm';

export class FkOnDeleteFix1694446892889 implements MigrationInterface {
  name = 'FkOnDeleteFix1694446892889';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT "FK_b09a0d360c3eeb7a25a598f04e4"`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT "FK_b09a0d360c3eeb7a25a598f04e4" FOREIGN KEY ([roleId]) REFERENCES [role]([id]) ON DELETE SET NULL ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT "FK_b09a0d360c3eeb7a25a598f04e4"`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT "FK_b09a0d360c3eeb7a25a598f04e4" FOREIGN KEY ([roleId]) REFERENCES [role]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
