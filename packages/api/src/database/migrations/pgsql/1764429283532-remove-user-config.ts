import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveUserConfig1764429283532 implements MigrationInterface {
    name = 'RemoveUserConfig1764429283532'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "config"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "config" text`);
    }

}
