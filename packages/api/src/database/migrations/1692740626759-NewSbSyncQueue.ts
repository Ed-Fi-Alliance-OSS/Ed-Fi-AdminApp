import { MigrationInterface, QueryRunner } from 'typeorm';

export class NewSbSyncQueue1692740626759 implements MigrationInterface {
  name = 'NewSbSyncQueue1692740626759';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "privilege" (name, description, code) VALUES ('sb-sync-queue:read', 'Read SB sync queue in the global scope.', 'sb-sync-queue:read'), ('sb-sync-queue:archive', 'Archive SB sync queue in the global scope.', 'sb-sync-queue:archive')`
    );

    await queryRunner.query(`CREATE VIEW "sb_sync_queue" AS
  select "id",
       "name",
       "priority",
       "data",
       "state",
       "retrylimit",
       "retrycount",
       "retrydelay",
       "retrybackoff",
       "startafter",
       "startedon",
       "singletonkey",
       "singletonon",
       "expirein",
       "createdon",
       "completedon",
       "keepuntil",
       "on_complete",
       "output",
       "archivedon"
from pgboss.archive
where name = 'sbe-sync'
union all
select "id",
       "name",
       "priority",
       "data",
       "state",
       "retrylimit",
       "retrycount",
       "retrydelay",
       "retrybackoff",
       "startafter",
       "startedon",
       "singletonkey",
       "singletonon",
       "expirein",
       "createdon",
       "completedon",
       "keepuntil",
       "on_complete",
       "output",
       null "archivedon"
from pgboss.job
where name = 'sbe-sync'
  `);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'sb_sync_queue',
        'select "id",\n       "name",\n       "priority",\n       "data",\n       "state",\n       "retrylimit",\n       "retrycount",\n       "retrydelay",\n       "retrybackoff",\n       "startafter",\n       "startedon",\n       "singletonkey",\n       "singletonon",\n       "expirein",\n       "createdon",\n       "completedon",\n       "keepuntil",\n       "on_complete",\n       "output",\n       "archivedon"\nfrom pgboss.archive\nwhere name = \'sbe-sync\'\nunion all\nselect "id",\n       "name",\n       "priority",\n       "data",\n       "state",\n       "retrylimit",\n       "retrycount",\n       "retrydelay",\n       "retrybackoff",\n       "startafter",\n       "startedon",\n       "singletonkey",\n       "singletonon",\n       "expirein",\n       "createdon",\n       "completedon",\n       "keepuntil",\n       "on_complete",\n       "output",\n       null "archivedon"\nfrom pgboss.job\nwhere name = \'sbe-sync\'',
      ]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "privilege" WHERE "code" in ('sb-sync-queue:read', 'sb-sync-queue:archive')`
    );

    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['VIEW', 'sb_sync_queue', 'public']
    );
    await queryRunner.query(`DROP VIEW "sb_sync_queue"`);
  }
}
