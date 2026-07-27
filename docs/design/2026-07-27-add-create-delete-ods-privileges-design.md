# Design: Add create-ods / delete-ods privileges to Full ownership and Tenant admin roles

## Summary

Add the `team.sb-environment.edfi-tenant:create-ods` and `team.sb-environment.edfi-tenant:delete-ods`
privileges to the **Full ownership** (role id 5) and **Tenant admin** (role id 6) roles, so that users
holding those roles can see the instance management pages after a migration.

## Context

- `team.sb-environment.edfi-tenant:create-ods` and `team.sb-environment.edfi-tenant:delete-ods` are
  privileges already checked by `packages\api\src\teams\edfi-tenants\odss\odss.controller.ts` (lines 82, 121).
- Roles are stored in the `role` table with a `privilegeIds` array/simple-array column
  (Postgres uses a native array; MSSQL uses a comma-delimited `simple-array`).
- Role IDs are seeded in `1697203599392-Seeding.ts`: id 5 = "Full ownership", id 6 = "Tenant admin".
- There is a directly analogous prior migration, `AddProfilePrivileges1719427712090`
  (`packages\api\src\database\migrations\{pgsql,mssql}\1719427712090-AddProfilePrivileges.ts`), which added
  four privileges to these same two roles in both engines, with matching smoke-test specs. This design
  follows that exact pattern for consistency.

## Approach

Add one new migration pair (Postgres + MSSQL), registered in `packages\api\src\database\typeorm.config.ts`.

### Postgres migration (`up`)
For each of the two privilege strings and each of role ids `5` and `6`:
```sql
UPDATE role SET "privilegeIds" = array_append("privilegeIds", '<privilege>')
WHERE id = <roleId> AND NOT ('<privilege>' = ANY("privilegeIds"))
```

### Postgres migration (`down`)
```sql
UPDATE role SET "privilegeIds" = array_remove("privilegeIds", '<privilege>') WHERE id = <roleId>
```

### MSSQL migration (`up`)
For each privilege/role combination (simple-array comma-delimited column):
```sql
UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0
  THEN [privilegeIds] + ',<privilege>' ELSE '<privilege>' END
WHERE id = <roleId> AND [privilegeIds] NOT LIKE '%<privilege>%'
```

### MSSQL migration (`down`)
```sql
UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',<privilege>,', ',')
WHERE id = <roleId>
```
followed by a cleanup of any leading/trailing comma left on affected rows.

### Migration naming/ordering
New migration timestamp will be a new millisecond epoch value greater than the current highest
(`1778026000000`, `CertificationSchema`) so migration ordering remains correct in both engine lists.

### Registration
Import and append the new Postgres/MSSQL migration classes to `getPostgreSQLMigrations()` and
`getMSSQLMigrations()` in `typeorm.config.ts`, matching the existing import/list conventions.

## Testing

Add one `.spec.ts` per engine, using the existing `runMigrationSmokeTest` helper
(`packages\api\src\test\helpers\migration-smoke-test.helper.ts`), matching the pattern used for
`1719427712090-AddProfilePrivileges.spec.ts`. This verifies `up()` and `down()` execute against a mocked
`QueryRunner` without throwing.

## Out of scope

- No changes to frontend, controllers, or the privilege-check logic itself — those already reference
  these privilege strings.
- No changes to other roles besides Full ownership (5) and Tenant admin (6).
