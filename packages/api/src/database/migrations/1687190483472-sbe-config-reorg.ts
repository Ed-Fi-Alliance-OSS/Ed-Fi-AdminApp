import { Sbe } from '@edanalytics/models-server';
import _ from 'lodash';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class SbeConfigReorg1687190483472 implements MigrationInterface {
  name = 'SbeConfigReorg1687190483472';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const sbes = (await queryRunner.manager.getRepository(Sbe).find()).map(
      (sbe): Sbe => ({
        ...sbe,
        displayName: sbe.displayName,
        configPrivate:
          sbe.configPrivate?.adminApiSecret && sbe.configPrivate?.sbeMetaSecret
            ? {
                adminApiSecret: sbe.configPrivate.adminApiSecret,
                sbeMetaSecret: sbe.configPrivate.sbeMetaSecret,
              }
            : undefined,
        configPublic: _({
          ...(sbe.configPublic ? JSON.parse(sbe.configPublic as string) : {}),
          adminApiKey: (sbe.configPrivate as any)?.adminApiKey ?? undefined,
          adminApiUrl: (sbe.configPrivate as any)?.adminApiUrl ?? undefined,
          sbeMetaKey: (sbe.configPrivate as any)?.sbeMetaKey ?? undefined,
          sbeMetaUrl: (sbe.configPrivate as any)?.sbeMetaUrl ?? undefined,
        })
          .omitBy(_.isUndefined)
          .value(),
      })
    );
    await queryRunner.query(`ALTER TABLE "sbe" DROP COLUMN "configPublic"`);
    await queryRunner.query(`ALTER TABLE "sbe" ADD "configPublic" jsonb`);
    await queryRunner.manager.getRepository(Sbe).save(sbes);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    throw new Error(
      'No "down" migration for sbe-config-reorg. This migration was created to prove out the migrations system, but there is no down method because we are still pre-production and there is no need for such frivolous things.'
    );
  }
}
