import { MigrationInterface, QueryRunner } from 'typeorm';
import { GLOBAL_ADMIN_ROLE_ID, GLOBAL_ADMIN_ROLE_TYPE } from '../shared/ac644-privilege-snapshot';

const CERTIFICATION_READ = 'certification:read';

/**
 * AC-672: grants the new global `certification:read` privilege to Global admin (role 2) so it
 * can open the Certification dashboard. Only a UserGlobal role at id 2 is touched; no other
 * role receives the code.
 */
export class AddCertificationReadToGlobalAdmin1794000000004 implements MigrationInterface {
  name = 'AddCertificationReadToGlobalAdmin1794000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const current = await this.currentPrivileges(queryRunner);
    if (current === null || current.includes(CERTIFICATION_READ)) return;

    await this.write(queryRunner, [...current, CERTIFICATION_READ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const current = await this.currentPrivileges(queryRunner);
    if (current === null || !current.includes(CERTIFICATION_READ)) return;

    await this.write(
      queryRunner,
      current.filter((code) => code !== CERTIFICATION_READ),
    );
  }

  private async currentPrivileges(queryRunner: QueryRunner): Promise<string[] | null> {
    const rows: { privilegeIds: string[] | null }[] = await queryRunner.query(
      `SELECT "privilegeIds" FROM "role" WHERE "id" = $1 AND "type" = $2`,
      [GLOBAL_ADMIN_ROLE_ID, GLOBAL_ADMIN_ROLE_TYPE],
    );
    if (!rows.length) return null;
    return rows[0].privilegeIds ?? [];
  }

  private async write(queryRunner: QueryRunner, privilegeIds: string[]): Promise<void> {
    await queryRunner.query(`UPDATE "role" SET "privilegeIds" = $1 WHERE "id" = $2`, [
      privilegeIds,
      GLOBAL_ADMIN_ROLE_ID,
    ]);
  }
}
