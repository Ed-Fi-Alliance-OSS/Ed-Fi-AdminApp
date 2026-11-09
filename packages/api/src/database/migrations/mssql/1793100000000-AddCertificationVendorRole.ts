import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  AC652_CERTIFICATION_PRIVILEGE_CODES,
  AC652_GRANTEE_ROLE_IDS,
  AC652_GRANTEE_ROLE_TYPE,
  CERTIFICATION_VENDOR_PRIVILEGE_CODES,
  CERTIFICATION_VENDOR_ROLE_DESCRIPTION,
  CERTIFICATION_VENDOR_ROLE_NAME,
  CERTIFICATION_VENDOR_ROLE_TYPE,
  GLOBAL_ADMIN_ROLE_ID,
  GLOBAL_ADMIN_ROLE_TYPE,
} from '../shared/ac652-certification-vendor';

// privilegeIds is a comma-separated string; matching on whole tokens avoids prefix collisions
// (for example `...edfi-tenant.ods:read` vs `...edfi-tenant:read`).
const APPEND = `[privilegeIds] = CASE WHEN LEN(ISNULL([privilegeIds], '')) > 0 THEN [privilegeIds] + ',' + @0 ELSE @0 END`;
const MISSING = `',' + ISNULL([privilegeIds], '') + ',' NOT LIKE '%,' + @0 + ',%'`;

export class AddCertificationVendorRole1793100000000 implements MigrationInterface {
  name = 'AddCertificationVendorRole1793100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const code of AC652_CERTIFICATION_PRIVILEGE_CODES) {
      // Global admin: only when role 2 is still the seeded UserGlobal role.
      await queryRunner.query(
        `UPDATE [role] SET ${APPEND} WHERE [id] = @1 AND [type] = @2 AND ${MISSING}`,
        [code, GLOBAL_ADMIN_ROLE_ID, GLOBAL_ADMIN_ROLE_TYPE],
      );
      // Roles 4 and 5: only while they are still the seeded ResourceOwnership roles.
      for (const roleId of AC652_GRANTEE_ROLE_IDS) {
        await queryRunner.query(
          `UPDATE [role] SET ${APPEND} WHERE [id] = @1 AND [type] = @2 AND ${MISSING}`,
          [code, roleId, AC652_GRANTEE_ROLE_TYPE],
        );
      }
    }

    await queryRunner.query(
      `INSERT INTO [role] ([name], [description], [type], [privilegeIds]) SELECT @0, @1, @2, @3 WHERE NOT EXISTS (SELECT 1 FROM [role] WHERE [name] = @0 AND [type] = @2 AND [teamId] IS NULL)`,
      [
        CERTIFICATION_VENDOR_ROLE_NAME,
        CERTIFICATION_VENDOR_ROLE_DESCRIPTION,
        CERTIFICATION_VENDOR_ROLE_TYPE,
        CERTIFICATION_VENDOR_PRIVILEGE_CODES.join(','),
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const roleFilter = `[name] = @0 AND [type] = @1 AND [teamId] IS NULL`;
    const roleParams = [CERTIFICATION_VENDOR_ROLE_NAME, CERTIFICATION_VENDOR_ROLE_TYPE];

    // The FK is already ON DELETE SET NULL; clearing explicitly keeps the intent visible.
    await queryRunner.query(
      `UPDATE [user_team_membership] SET [roleId] = NULL WHERE [roleId] IN (SELECT [id] FROM [role] WHERE ${roleFilter})`,
      roleParams,
    );
    await queryRunner.query(`DELETE FROM [role] WHERE ${roleFilter}`, roleParams);

    // Same type guards as up(): skip role ids 2, 4, 5 if they no longer hold the seeded type.
    // TRIM cleans up the leading/trailing commas left by REPLACE in the same guarded statement.
    const grantees: [number, string][] = [
      [GLOBAL_ADMIN_ROLE_ID, GLOBAL_ADMIN_ROLE_TYPE],
      ...AC652_GRANTEE_ROLE_IDS.map((id): [number, string] => [id, AC652_GRANTEE_ROLE_TYPE]),
    ];
    for (const code of AC652_CERTIFICATION_PRIVILEGE_CODES) {
      for (const [roleId, roleType] of grantees) {
        await queryRunner.query(
          `UPDATE [role] SET [privilegeIds] = TRIM(',' FROM REPLACE(',' + ISNULL([privilegeIds], '') + ',', ',' + @0 + ',', ',')) WHERE [id] = @1 AND [type] = @2`,
          [code, roleId, roleType],
        );
      }
    }
  }
}
