import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveRemainingAppLauncherThings1697207080973 implements MigrationInterface {
  name = 'RemoveRemainingAppLauncherThings1697207080973';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "app_launcher"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`create table public.app_launcher
        (
            id         serial
                constraint "PK_28730cf6765e38a38cc7994f2c8"
                    primary key,
            url        varchar not null,
            "clientId" varchar not null,
            "poolId"   varchar not null
        );

        alter table public.app_launcher
            owner to sbaa;

        `);
  }
}
