import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIntegrationApps1744933017953 implements MigrationInterface {
  name = 'CreateIntegrationApps1744933017953';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE [integration_app] ([id] INT IDENTITY(1,1) NOT NULL, [created] datetime2 NOT NULL DEFAULT getdate(), [modified] datetime2 NOT NULL DEFAULT getdate(), [createdById] integer, [modifiedById] integer, [applicationId] integer NOT NULL, [applicationName] NVARCHAR(100) NOT NULL, [edfiTenantId] integer NOT NULL, [edorgIds] varchar NOT NULL DEFAULT '[]', [integrationProviderId] integer NOT NULL, [odsId] integer NOT NULL, [sbEnvironmentId] integer NOT NULL, CONSTRAINT [PK_e1de4484e14a51defadd1098ead] PRIMARY KEY ([id]))`
    );
    await queryRunner.query(
      `ALTER TABLE [integration_app] ADD CONSTRAINT [FK_399b9dc9729e57736004ce43f18] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [integration_app] ADD CONSTRAINT [FK_92cfae5591c74df461583ee1030] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [integration_app] ADD CONSTRAINT [FK_f1863590a115f0d79c92ece3788] FOREIGN KEY ([edfiTenantId]) REFERENCES [edfi_tenant]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [integration_app] ADD CONSTRAINT [FK_02db5fef1211345bccbb77de7b0] FOREIGN KEY ([integrationProviderId]) REFERENCES [integration_provider]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    // bad constraints set to no action, but could be problematic. there may be another path already covering this, liked edfi_tenant above. need to see diagram
    await queryRunner.query(
      `ALTER TABLE [integration_app] ADD CONSTRAINT [FK_ab1cf505e0b1d4ee27ded0db441] FOREIGN KEY ([odsId]) REFERENCES [ods]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [integration_app] ADD CONSTRAINT [FK_d8f9366f90c1cba66f83d9f425b] FOREIGN KEY ([sbEnvironmentId]) REFERENCES [sb_environment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE [integration_app] DROP CONSTRAINT [FK_d8f9366f90c1cba66f83d9f425b]`
    );
    await queryRunner.query(
      `ALTER TABLE [integration_app] DROP CONSTRAINT [FK_ab1cf505e0b1d4ee27ded0db441]`
    );
    await queryRunner.query(
      `ALTER TABLE [integration_app] DROP CONSTRAINT [FK_02db5fef1211345bccbb77de7b0]`
    );
    await queryRunner.query(
      `ALTER TABLE [integration_app] DROP CONSTRAINT [FK_f1863590a115f0d79c92ece3788]`
    );
    await queryRunner.query(
      `ALTER TABLE [integration_app] DROP CONSTRAINT [FK_92cfae5591c74df461583ee1030]`
    );
    await queryRunner.query(
      `ALTER TABLE [integration_app] DROP CONSTRAINT [FK_399b9dc9729e57736004ce43f18]`
    );
    await queryRunner.query(`DROP TABLE [integration_app]`);
  }
}
