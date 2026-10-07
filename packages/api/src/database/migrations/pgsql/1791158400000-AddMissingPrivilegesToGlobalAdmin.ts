import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  AC644_ALL_PRIVILEGE_CODES,
  GLOBAL_ADMIN_ROLE_ID,
  GLOBAL_ADMIN_ROLE_TYPE,
} from '../shared/ac644-privilege-snapshot';

/**
 * AC-644: Global admin (role 2) was seeded with every privilege that existed at seed time,
 * but later privilege migrations only updated roles 5 and 6. The no-escalation rule requires
 * the admin to hold everything it delegates, so backfill every current code. Only a
 * UserGlobal role at id 2 is touched; anything else there is left alone.
 */
export class AddMissingPrivilegesToGlobalAdmin1791158400000 implements MigrationInterface {
  name = 'AddMissingPrivilegesToGlobalAdmin1791158400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { privilegeIds: string[] | null }[] = await queryRunner.query(
      `SELECT "privilegeIds" FROM "role" WHERE "id" = $1 AND "type" = $2`,
      [GLOBAL_ADMIN_ROLE_ID, GLOBAL_ADMIN_ROLE_TYPE]
    );
    if (!rows.length) return;

    const current = rows[0].privilegeIds ?? [];
    const missing = AC644_ALL_PRIVILEGE_CODES.filter((code) => !current.includes(code));
    if (!missing.length) return;

    await queryRunner.query(`UPDATE "role" SET "privilegeIds" = $1 WHERE "id" = $2`, [
      [...current, ...missing],
      GLOBAL_ADMIN_ROLE_ID,
    ]);
  }

  public async down(): Promise<void> {
    // No-op: we cannot know which of these codes role 2 already held before `up` ran,
    // so removing them could strip privileges the admin legitimately had.
  }
}
