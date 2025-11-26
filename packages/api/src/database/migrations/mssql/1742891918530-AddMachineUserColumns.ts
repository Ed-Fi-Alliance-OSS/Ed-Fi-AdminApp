import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMachineUserColumns1742186909224 implements MigrationInterface {
  name = 'AddMachineUserColumns1742186909224';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE [user] ADD [userType] VARCHAR(10) NOT NULL DEFAULT 'human'`
    );
    await queryRunner.query(
      `ALTER TABLE [user] ADD CONSTRAINT [CHK_user_userType] CHECK ([userType] IN ('human', 'machine'))`
    );
    await queryRunner.query(`ALTER TABLE [user] ADD [clientId] NVARCHAR(255) NULL`);
    await queryRunner.query(`ALTER TABLE [user] ADD [description] NVARCHAR(255) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE [user] DROP CONSTRAINT [CHK_user_userType]`);
    await queryRunner.query(`ALTER TABLE [user] DROP COLUMN [userType]`);
    await queryRunner.query(`ALTER TABLE [user] DROP COLUMN [description]`);
    await queryRunner.query(`ALTER TABLE [user] DROP COLUMN [clientId]`);
  }
}
