import { MigrationInterface, QueryRunner } from 'typeorm';

export class IntegrationProviders1744127024224 implements MigrationInterface {
  name = 'IntegrationProviders1744127024224';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE [integration_provider] ([id] INT IDENTITY(1,1) NOT NULL, [created] datetime2 NOT NULL DEFAULT getdate(), [modified] datetime2 NOT NULL DEFAULT getdate(), [createdById] integer, [modifiedById] integer, [name] nvarchar(100) NOT NULL, [description] NVARCHAR(255) NOT NULL, CONSTRAINT [PK_da855fe9095d6c59ea7072408a0] PRIMARY KEY ([id]))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX [IDX_0f80b4b1ae8514fb0874197f5d] ON [integration_provider] ([name]) `
    );
    await queryRunner.query(
      `ALTER TABLE [integration_provider] ADD CONSTRAINT [FK_357a7d86266b4d4ecbf2eabd2e1] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [integration_provider] ADD CONSTRAINT [FK_a3ac82235ff364e5dd024704f56] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE [integration_provider] DROP CONSTRAINT [FK_a3ac82235ff364e5dd024704f56]`
    );
    await queryRunner.query(
      `ALTER TABLE [integration_provider] DROP CONSTRAINT [FK_357a7d86266b4d4ecbf2eabd2e1]`
    );
    await queryRunner.query(`DROP INDEX [IDX_0f80b4b1ae8514fb0874197f5d] ON [integration_provider]`);
    await queryRunner.query(`DROP TABLE [integration_provider]`);
  }
}
