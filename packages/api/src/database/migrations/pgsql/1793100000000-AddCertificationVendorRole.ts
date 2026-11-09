import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  AC652_CERTIFICATION_PRIVILEGE_CODES,
  AC652_GRANTEE_ROLE_IDS,
  CERTIFICATION_VENDOR_PRIVILEGE_CODES,
  CERTIFICATION_VENDOR_ROLE_DESCRIPTION,
  CERTIFICATION_VENDOR_ROLE_NAME,
  CERTIFICATION_VENDOR_ROLE_TYPE,
  GLOBAL_ADMIN_ROLE_ID,
  GLOBAL_ADMIN_ROLE_TYPE,
} from '../shared/ac652-certification-vendor';

export class AddCertificationVendorRole1793100000000 implements MigrationInterface {
  name = 'AddCertificationVendorRole1793100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const code of AC652_CERTIFICATION_PRIVILEGE_CODES) {
      // Global admin: only when role 2 is still the seeded UserGlobal role.
      await queryRunner.query(
        `UPDATE "role" SET "privilegeIds" = array_append(COALESCE("privilegeIds", '{}'), $1::text) WHERE "id" = $2 AND "type" = $3 AND NOT ($1::text = ANY(COALESCE("privilegeIds", '{}')))`,
        [code, GLOBAL_ADMIN_ROLE_ID, GLOBAL_ADMIN_ROLE_TYPE],
      );
      for (const roleId of AC652_GRANTEE_ROLE_IDS) {
        await queryRunner.query(
          `UPDATE "role" SET "privilegeIds" = array_append(COALESCE("privilegeIds", '{}'), $1::text) WHERE "id" = $2 AND NOT ($1::text = ANY(COALESCE("privilegeIds", '{}')))`,
          [code, roleId],
        );
      }
    }

    await queryRunner.query(
      `INSERT INTO "role" ("name", "description", "type", "privilegeIds") SELECT $1::varchar, $2::varchar, $3::text, $4::text[] WHERE NOT EXISTS (SELECT 1 FROM "role" WHERE "name" = $1::varchar AND "type" = $3::text AND "teamId" IS NULL)`,
      [
        CERTIFICATION_VENDOR_ROLE_NAME,
        CERTIFICATION_VENDOR_ROLE_DESCRIPTION,
        CERTIFICATION_VENDOR_ROLE_TYPE,
        [...CERTIFICATION_VENDOR_PRIVILEGE_CODES],
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const roleFilter = `"name" = $1 AND "type" = $2 AND "teamId" IS NULL`;
    const roleParams = [CERTIFICATION_VENDOR_ROLE_NAME, CERTIFICATION_VENDOR_ROLE_TYPE];

    // The FK is already ON DELETE SET NULL; clearing explicitly keeps the intent visible.
    await queryRunner.query(
      `UPDATE "user_team_membership" SET "roleId" = NULL WHERE "roleId" IN (SELECT "id" FROM "role" WHERE ${roleFilter})`,
      roleParams,
    );
    await queryRunner.query(`DELETE FROM "role" WHERE ${roleFilter}`, roleParams);

    for (const code of AC652_CERTIFICATION_PRIVILEGE_CODES) {
      for (const roleId of [GLOBAL_ADMIN_ROLE_ID, ...AC652_GRANTEE_ROLE_IDS]) {
        await queryRunner.query(
          `UPDATE "role" SET "privilegeIds" = array_remove(COALESCE("privilegeIds", '{}'), $1::text) WHERE "id" = $2`,
          [code, roleId],
        );
      }
    }
  }
}
