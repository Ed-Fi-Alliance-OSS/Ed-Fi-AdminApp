# Add create-ods / delete-ods Privileges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `team.sb-environment.edfi-tenant:create-ods` and `team.sb-environment.edfi-tenant:delete-ods` privileges to the "Full ownership" (role id 5) and "Tenant admin" (role id 6) roles, in both Postgres and MSSQL, via a TypeORM migration pair with unit tests.

**Architecture:** One new TypeORM migration class per database engine (Postgres, MSSQL), each appending the two new privilege strings onto the `role.privilegeIds` column for role ids 5 and 6, with idempotent `up()` and a reversible `down()`. Migrations are registered in `packages\api\src\database\typeorm.config.ts`. Each migration gets a smoke-test spec using the existing `runMigrationSmokeTest` helper.

**Tech Stack:** TypeORM (migrations), Jest (tests), Nx (`nx run api:test`), Postgres native arrays, MSSQL `simple-array` (comma-delimited string).

## Global Constraints

- Migration timestamp for both engines: `1785181605952` (must sort after the current highest migration timestamp, `1778026000000`).
- Privilege strings (exact, case-sensitive): `team.sb-environment.edfi-tenant:create-ods`, `team.sb-environment.edfi-tenant:delete-ods`.
- Role ids (exact): `5` = Full ownership, `6` = Tenant admin (seeded in `1697203599392-Seeding.ts`).
- Follow the exact pattern of the existing migration pair `AddProfilePrivileges1719427712090` (Postgres: `array_append`/`array_remove` with `ANY()` dedup guard; MSSQL: string-concat with `LIKE` dedup guard and `REPLACE`-based removal).
- 2-space indentation, single quotes, trailing semicolons — match existing migration file style exactly (see referenced files).
- Run tests with: `npx jest --config jest.config.ts --testPathPatterns=<Pattern>` from `packages\api`.

---

### Task 1: Postgres migration for create-ods / delete-ods privileges

**Files:**
- Create: `packages\api\src\database\migrations\pgsql\1785181605952-AddCreateDeleteOdsPrivileges.ts`
- Create: `packages\api\src\database\migrations\pgsql\1785181605952-AddCreateDeleteOdsPrivileges.spec.ts`

**Interfaces:**
- Consumes: `runMigrationSmokeTest` from `packages\api\src\test\helpers\migration-smoke-test.helper.ts` (signature: `runMigrationSmokeTest(MigrationClass: new () => MigrationInterface): void`).
- Produces: exported class `AddCreateDeleteOdsPrivileges1785181605952` implementing `MigrationInterface`, with `name = 'AddCreateDeleteOdsPrivileges1785181605952'`, and `up(queryRunner: QueryRunner): Promise<void>` / `down(queryRunner: QueryRunner): Promise<void>`. Task 3 imports this class from this exact file path.

- [ ] **Step 1: Write the failing spec test**

Create `packages\api\src\database\migrations\pgsql\1785181605952-AddCreateDeleteOdsPrivileges.spec.ts`:

```typescript
import 'reflect-metadata';
import { AddCreateDeleteOdsPrivileges1785181605952 } from './1785181605952-AddCreateDeleteOdsPrivileges';
import { runMigrationSmokeTest } from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(AddCreateDeleteOdsPrivileges1785181605952);
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages\api`): `npx jest --config jest.config.ts --testPathPatterns=1785181605952-AddCreateDeleteOdsPrivileges`
Expected: FAIL — Cannot find module `./1785181605952-AddCreateDeleteOdsPrivileges` (the migration file doesn't exist yet).

- [ ] **Step 3: Write the migration implementation**

Create `packages\api\src\database\migrations\pgsql\1785181605952-AddCreateDeleteOdsPrivileges.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreateDeleteOdsPrivileges1785181605952 implements MigrationInterface {
  name = 'AddCreateDeleteOdsPrivileges1785181605952';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add create-ods/delete-ods privileges to Tenant admin role (ID 6)
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_append("privilegeIds", 'team.sb-environment.edfi-tenant:create-ods') WHERE id = 6 AND NOT ('team.sb-environment.edfi-tenant:create-ods' = ANY("privilegeIds"))`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_append("privilegeIds", 'team.sb-environment.edfi-tenant:delete-ods') WHERE id = 6 AND NOT ('team.sb-environment.edfi-tenant:delete-ods' = ANY("privilegeIds"))`
    );

    // Add create-ods/delete-ods privileges to Full ownership role (ID 5)
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_append("privilegeIds", 'team.sb-environment.edfi-tenant:create-ods') WHERE id = 5 AND NOT ('team.sb-environment.edfi-tenant:create-ods' = ANY("privilegeIds"))`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_append("privilegeIds", 'team.sb-environment.edfi-tenant:delete-ods') WHERE id = 5 AND NOT ('team.sb-environment.edfi-tenant:delete-ods' = ANY("privilegeIds"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove create-ods/delete-ods privileges from Tenant admin role (ID 6)
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_remove("privilegeIds", 'team.sb-environment.edfi-tenant:create-ods') WHERE id = 6`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_remove("privilegeIds", 'team.sb-environment.edfi-tenant:delete-ods') WHERE id = 6`
    );

    // Remove create-ods/delete-ods privileges from Full ownership role (ID 5)
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_remove("privilegeIds", 'team.sb-environment.edfi-tenant:create-ods') WHERE id = 5`
    );
    await queryRunner.query(
      `UPDATE role SET "privilegeIds" = array_remove("privilegeIds", 'team.sb-environment.edfi-tenant:delete-ods') WHERE id = 5`
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `packages\api`): `npx jest --config jest.config.ts --testPathPatterns=1785181605952-AddCreateDeleteOdsPrivileges`
Expected: `PASS api src/database/migrations/pgsql/1785181605952-AddCreateDeleteOdsPrivileges.spec.ts` with 2 tests passed (`up() returns a Promise`, `down() returns a Promise (if implemented)`).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/database/migrations/pgsql/1785181605952-AddCreateDeleteOdsPrivileges.ts packages/api/src/database/migrations/pgsql/1785181605952-AddCreateDeleteOdsPrivileges.spec.ts
git commit -m "feat: add create-ods/delete-ods privileges migration for Postgres"
```

---

### Task 2: MSSQL migration for create-ods / delete-ods privileges

**Files:**
- Create: `packages\api\src\database\migrations\mssql\1785181605952-AddCreateDeleteOdsPrivileges.ts`
- Create: `packages\api\src\database\migrations\mssql\1785181605952-AddCreateDeleteOdsPrivileges.spec.ts`

**Interfaces:**
- Consumes: `runMigrationSmokeTest` from `packages\api\src\test\helpers\migration-smoke-test.helper.ts` (same as Task 1).
- Produces: exported class `AddCreateDeleteOdsPrivileges1785181605952` implementing `MigrationInterface`, with `name = 'AddCreateDeleteOdsPrivileges1785181605952'`, and `up(queryRunner: QueryRunner): Promise<void>` / `down(queryRunner: QueryRunner): Promise<void>`. Task 3 imports this class from this exact file path (aliased to distinguish from Task 1's same-named Postgres class).

- [ ] **Step 1: Write the failing spec test**

Create `packages\api\src\database\migrations\mssql\1785181605952-AddCreateDeleteOdsPrivileges.spec.ts`:

```typescript
import 'reflect-metadata';
import { AddCreateDeleteOdsPrivileges1785181605952 } from './1785181605952-AddCreateDeleteOdsPrivileges';
import { runMigrationSmokeTest } from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(AddCreateDeleteOdsPrivileges1785181605952);
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages\api`): `npx jest --config jest.config.ts --testPathPatterns=mssql/1785181605952-AddCreateDeleteOdsPrivileges`
Expected: FAIL — Cannot find module `./1785181605952-AddCreateDeleteOdsPrivileges` (the migration file doesn't exist yet).

- [ ] **Step 3: Write the migration implementation**

Create `packages\api\src\database\migrations\mssql\1785181605952-AddCreateDeleteOdsPrivileges.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreateDeleteOdsPrivileges1785181605952 implements MigrationInterface {
  name = 'AddCreateDeleteOdsPrivileges1785181605952';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add create-ods/delete-ods privileges to Tenant admin role (ID 6)
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0 THEN [privilegeIds] + ',team.sb-environment.edfi-tenant:create-ods' ELSE 'team.sb-environment.edfi-tenant:create-ods' END WHERE id = 6 AND [privilegeIds] NOT LIKE '%team.sb-environment.edfi-tenant:create-ods%'`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0 THEN [privilegeIds] + ',team.sb-environment.edfi-tenant:delete-ods' ELSE 'team.sb-environment.edfi-tenant:delete-ods' END WHERE id = 6 AND [privilegeIds] NOT LIKE '%team.sb-environment.edfi-tenant:delete-ods%'`
    );

    // Add create-ods/delete-ods privileges to Full ownership role (ID 5)
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0 THEN [privilegeIds] + ',team.sb-environment.edfi-tenant:create-ods' ELSE 'team.sb-environment.edfi-tenant:create-ods' END WHERE id = 5 AND [privilegeIds] NOT LIKE '%team.sb-environment.edfi-tenant:create-ods%'`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = CASE WHEN LEN([privilegeIds]) > 0 THEN [privilegeIds] + ',team.sb-environment.edfi-tenant:delete-ods' ELSE 'team.sb-environment.edfi-tenant:delete-ods' END WHERE id = 5 AND [privilegeIds] NOT LIKE '%team.sb-environment.edfi-tenant:delete-ods%'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove create-ods/delete-ods privileges from Tenant admin role (ID 6)
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',team.sb-environment.edfi-tenant:create-ods,', ',') WHERE id = 6`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',team.sb-environment.edfi-tenant:delete-ods,', ',') WHERE id = 6`
    );

    // Remove create-ods/delete-ods privileges from Full ownership role (ID 5)
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',team.sb-environment.edfi-tenant:create-ods,', ',') WHERE id = 5`
    );
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE(',' + [privilegeIds] + ',', ',team.sb-environment.edfi-tenant:delete-ods,', ',') WHERE id = 5`
    );

    // Clean up leading/trailing commas left by REPLACE
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = TRIM(',' FROM [privilegeIds]) WHERE id IN (5, 6)`
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `packages\api`): `npx jest --config jest.config.ts --testPathPatterns=mssql/1785181605952-AddCreateDeleteOdsPrivileges`
Expected: `PASS api src/database/migrations/mssql/1785181605952-AddCreateDeleteOdsPrivileges.spec.ts` with 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/database/migrations/mssql/1785181605952-AddCreateDeleteOdsPrivileges.ts packages/api/src/database/migrations/mssql/1785181605952-AddCreateDeleteOdsPrivileges.spec.ts
git commit -m "feat: add create-ods/delete-ods privileges migration for MSSQL"
```

---

### Task 3: Register both migrations in typeorm.config.ts

**Files:**
- Modify: `packages\api\src\database\typeorm.config.ts`

**Interfaces:**
- Consumes: `AddCreateDeleteOdsPrivileges1785181605952` exported from `./migrations/pgsql/1785181605952-AddCreateDeleteOdsPrivileges` (Task 1) and from `./migrations/mssql/1785181605952-AddCreateDeleteOdsPrivileges` (Task 2), imported with aliases `PgsqlAddCreateDeleteOdsPrivileges1785181605952` and `MssqlAddCreateDeleteOdsPrivileges1785181605952` respectively (matching the existing alias convention in this file).
- Produces: updated `getPostgreSQLMigrations()` and `getMSSQLMigrations()` arrays that TypeORM uses at runtime — no other task depends on this.

- [ ] **Step 1: Add the Postgres import**

In `packages\api\src\database\typeorm.config.ts`, after the line:

```typescript
import { AddOdsInstanceMetadataFields1751299288000 as PgsqlAddOdsInstanceMetadataFields1751299288000 } from './migrations/pgsql/1751299288000-AddOdsInstanceMetadataFields';
```

add:

```typescript
import { AddCreateDeleteOdsPrivileges1785181605952 as PgsqlAddCreateDeleteOdsPrivileges1785181605952 } from './migrations/pgsql/1785181605952-AddCreateDeleteOdsPrivileges';
```

- [ ] **Step 2: Add the MSSQL import**

After the line:

```typescript
import { AddOdsInstanceMetadataFields1751299288000 as MssqlAddOdsInstanceMetadataFields1751299288000 } from './migrations/mssql/1751299288000-AddOdsInstanceMetadataFields';
```

add:

```typescript
import { AddCreateDeleteOdsPrivileges1785181605952 as MssqlAddCreateDeleteOdsPrivileges1785181605952 } from './migrations/mssql/1785181605952-AddCreateDeleteOdsPrivileges';
```

- [ ] **Step 3: Append to `getPostgreSQLMigrations()`**

Change:

```typescript
  PgsqlAddOdsInstanceMetadataFields1751299288000,
];
```

to:

```typescript
  PgsqlAddOdsInstanceMetadataFields1751299288000,
  PgsqlAddCreateDeleteOdsPrivileges1785181605952,
];
```

(this is the closing line of `getPostgreSQLMigrations`, not `getMSSQLMigrations` — verify by checking the array name a few lines above the edited line).

- [ ] **Step 4: Append to `getMSSQLMigrations()`**

Change:

```typescript
  MssqlAddOdsInstanceMetadataFields1751299288000,
];
```

to:

```typescript
  MssqlAddOdsInstanceMetadataFields1751299288000,
  MssqlAddCreateDeleteOdsPrivileges1785181605952,
];
```

- [ ] **Step 5: Run the full API test suite to verify nothing broke**

Run (from `packages\api`): `npx jest --config jest.config.ts`
Expected: `Test Suites: 113 passed, 113 total` (111 existing + 2 new specs added in Tasks 1–2), all tests passing, no TypeScript compile errors.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/database/typeorm.config.ts
git commit -m "feat: register create-ods/delete-ods privileges migrations"
```
