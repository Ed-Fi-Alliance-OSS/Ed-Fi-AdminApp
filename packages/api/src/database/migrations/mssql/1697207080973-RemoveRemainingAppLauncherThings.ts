import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveRemainingAppLauncherThings1697207080973 implements MigrationInterface {
  name = 'RemoveRemainingAppLauncherThings1697207080973';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE [app_launcher]`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE [app_launcher] (
    	[id] int IDENTITY(1,1) NOT NULL, 
    	[url] nvarchar(255) NOT NULL, 
    	[clientId] nvarchar(255) NOT NULL, 
    	[poolId] nvarchar(255) NOT NULL, 
    	CONSTRAINT [PK_28730cf6765e38a38cc7994f2c8] PRIMARY KEY ([id]));
    `);
  }
}
