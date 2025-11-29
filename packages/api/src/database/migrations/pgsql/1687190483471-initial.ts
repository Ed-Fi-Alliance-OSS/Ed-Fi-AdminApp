import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1688158300508 implements MigrationInterface {
  name = 'Initial1687190483471';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user" ("id" SERIAL NOT NULL, "created" TIMESTAMP NOT NULL DEFAULT now(), "modified" TIMESTAMP NOT NULL DEFAULT now(), "deleted" TIMESTAMP, "createdById" integer, "modifiedById" integer, "deletedById" integer, "username" character varying NOT NULL, "givenName" character varying, "familyName" character varying, "roleId" integer, "isActive" boolean NOT NULL, "config" text, CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "tenant" ("id" SERIAL NOT NULL, "created" TIMESTAMP NOT NULL DEFAULT now(), "modified" TIMESTAMP NOT NULL DEFAULT now(), "deleted" TIMESTAMP, "createdById" integer, "modifiedById" integer, "deletedById" integer, "name" character varying NOT NULL, CONSTRAINT "PK_da8c6efd67bb301e810e56ac139" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "ods" ("id" SERIAL NOT NULL, "created" TIMESTAMP NOT NULL DEFAULT now(), "modified" TIMESTAMP NOT NULL DEFAULT now(), "deleted" TIMESTAMP, "createdById" integer, "modifiedById" integer, "deletedById" integer, "sbeId" integer NOT NULL, "dbName" character varying NOT NULL, CONSTRAINT "PK_85909268d35d1e1b470fd8706d7" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "sbe" ("id" SERIAL NOT NULL, "created" TIMESTAMP NOT NULL DEFAULT now(), "modified" TIMESTAMP NOT NULL DEFAULT now(), "deleted" TIMESTAMP, "createdById" integer, "modifiedById" integer, "deletedById" integer, "envLabel" character varying NOT NULL, "configPublic" text NOT NULL, "configPrivate" jsonb, CONSTRAINT "PK_4ab896e8044a62fcb3d2adb2957" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "edorg" ("id" SERIAL NOT NULL, "created" TIMESTAMP NOT NULL DEFAULT now(), "modified" TIMESTAMP NOT NULL DEFAULT now(), "deleted" TIMESTAMP, "createdById" integer, "modifiedById" integer, "deletedById" integer, "odsId" integer NOT NULL, "sbeId" integer NOT NULL, "parentId" integer, "educationOrganizationId" character varying NOT NULL, "nameOfInstitution" character varying NOT NULL, "discriminator" character varying NOT NULL, CONSTRAINT "PK_8ff8cd575c93fd763da4020d0bb" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "user_tenant_membership" ("id" SERIAL NOT NULL, "created" TIMESTAMP NOT NULL DEFAULT now(), "modified" TIMESTAMP NOT NULL DEFAULT now(), "deleted" TIMESTAMP, "createdById" integer, "modifiedById" integer, "deletedById" integer, "tenantId" integer NOT NULL, "userId" integer NOT NULL, "roleId" integer, CONSTRAINT "PK_9bea2e1d154a4955c5de1d08473" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "privilege" ("name" character varying NOT NULL, "description" character varying NOT NULL, "code" character varying NOT NULL, CONSTRAINT "PK_b0141171c058b8b5d2cf5a5bce9" PRIMARY KEY ("code"))`
    );
    await queryRunner.query(
      `CREATE TABLE "role" ("id" SERIAL NOT NULL, "created" TIMESTAMP NOT NULL DEFAULT now(), "modified" TIMESTAMP NOT NULL DEFAULT now(), "deleted" TIMESTAMP, "createdById" integer, "modifiedById" integer, "deletedById" integer, "name" character varying NOT NULL, "description" character varying, "tenantId" integer, "type" text NOT NULL, CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "ownership" ("id" SERIAL NOT NULL, "created" TIMESTAMP NOT NULL DEFAULT now(), "modified" TIMESTAMP NOT NULL DEFAULT now(), "deleted" TIMESTAMP, "createdById" integer, "modifiedById" integer, "deletedById" integer, "tenantId" integer NOT NULL, "roleId" integer, "sbeId" integer, "odsId" integer, "edorgId" integer, CONSTRAINT "PK_f911f1e192c37beebcf9ef2f756" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "oidc" ("id" SERIAL NOT NULL, "issuer" character varying NOT NULL, "clientId" character varying NOT NULL, "clientSecret" character varying NOT NULL, "scope" character varying NOT NULL, CONSTRAINT "PK_532548120e364bf777d351c46b0" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "app_launcher" ("id" SERIAL NOT NULL, "url" character varying NOT NULL, "clientId" character varying NOT NULL, "poolId" character varying NOT NULL, CONSTRAINT "PK_28730cf6765e38a38cc7994f2c8" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "role_privileges_privilege" ("roleId" integer NOT NULL, "privilegeCode" character varying NOT NULL, CONSTRAINT "PK_de907a0603630a2c0820943f738" PRIMARY KEY ("roleId", "privilegeCode"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d11ab7c8589ca17646c5345fb7" ON "role_privileges_privilege" ("roleId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_07bc07701aba37968ecf1f4ba1" ON "role_privileges_privilege" ("privilegeCode") `
    );
    await queryRunner.query(
      `CREATE TABLE "edorg_closure" ("id_ancestor" integer NOT NULL, "id_descendant" integer NOT NULL, CONSTRAINT "PK_b515d3f3a0246481749362eec94" PRIMARY KEY ("id_ancestor", "id_descendant"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b67fab0829f3b586fc9cd24cb9" ON "edorg_closure" ("id_ancestor") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_535b90f37f800a350ce4de5b90" ON "edorg_closure" ("id_descendant") `
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_45c0d39d1f9ceeb56942db93cc5" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_b7b62199aa0ff55f53e0137b217" FOREIGN KEY ("modifiedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_c3062c4102a912dfe7195a72bfb" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "tenant" ADD CONSTRAINT "FK_372fed256480b89aafbfb2f9e8b" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "tenant" ADD CONSTRAINT "FK_1636cc00622963d7c7a5499312c" FOREIGN KEY ("modifiedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "tenant" ADD CONSTRAINT "FK_d5a26eda6ff5cef9bbff80770d6" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "ods" ADD CONSTRAINT "FK_fc6df40388b53b0603abb95846a" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "ods" ADD CONSTRAINT "FK_75491c4f18c4da07baa1da7f9c0" FOREIGN KEY ("modifiedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "ods" ADD CONSTRAINT "FK_cc1b217b80a24fd0031146c944a" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "ods" ADD CONSTRAINT "FK_829131f86e2d025918e2dee5a40" FOREIGN KEY ("sbeId") REFERENCES "sbe"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "sbe" ADD CONSTRAINT "FK_ce4b1775b7e60418caa2df331a2" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "sbe" ADD CONSTRAINT "FK_8f912321b2a5d074197d2169f72" FOREIGN KEY ("modifiedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "sbe" ADD CONSTRAINT "FK_ab37768ff29885bd116f519bd3d" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "edorg" ADD CONSTRAINT "FK_94e49b7b79f2b23d4685809c9e3" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "edorg" ADD CONSTRAINT "FK_3e3a6841fcba09f3cf956944fa0" FOREIGN KEY ("modifiedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "edorg" ADD CONSTRAINT "FK_00c8aa855170254728ee9fe3864" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "edorg" ADD CONSTRAINT "FK_eacb927c57ecca3c22ab93fb849" FOREIGN KEY ("odsId") REFERENCES "ods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "edorg" ADD CONSTRAINT "FK_4f7237384382e4796332a25ea48" FOREIGN KEY ("sbeId") REFERENCES "sbe"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "edorg" ADD CONSTRAINT "FK_bf2fe95bd8a50a2346489472df2" FOREIGN KEY ("parentId") REFERENCES "edorg"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_tenant_membership" ADD CONSTRAINT "FK_c5b276250571c341867e2b7ca1c" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_tenant_membership" ADD CONSTRAINT "FK_37a8b3d9ab253bcc6651a290013" FOREIGN KEY ("modifiedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_tenant_membership" ADD CONSTRAINT "FK_1d21629daa4dda26aedd2c3b03d" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_tenant_membership" ADD CONSTRAINT "FK_559208b256dbd6a371f121333e5" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_tenant_membership" ADD CONSTRAINT "FK_825eb5ca32b71e4db155dc1b7c9" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_tenant_membership" ADD CONSTRAINT "FK_49e594e22dbe4c5e78689dbcb5e" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "role" ADD CONSTRAINT "FK_528f294633a808293425ae2ab56" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "role" ADD CONSTRAINT "FK_30fe66100b98ed08e1c9fdee0e8" FOREIGN KEY ("modifiedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "role" ADD CONSTRAINT "FK_c5d666dd8bf212b0d9ba353cb4f" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "role" ADD CONSTRAINT "FK_1751a572e91385a09d41c624714" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "FK_9e38f4be50b8931ae3f2cc9468e" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "FK_cc065f6b477a818771878eeb628" FOREIGN KEY ("modifiedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "FK_b6c6688493760930cef57202552" FOREIGN KEY ("deletedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "FK_1d4587643a7ce7fa5727816d7cc" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "FK_b09a0d360c3eeb7a25a598f04e4" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "FK_dcde9ae7d31fa30b2623697ff28" FOREIGN KEY ("sbeId") REFERENCES "sbe"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "FK_29b0ffd913131cf5282742fa893" FOREIGN KEY ("odsId") REFERENCES "ods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" ADD CONSTRAINT "FK_091071fb2770f4bf2e3192e6192" FOREIGN KEY ("edorgId") REFERENCES "edorg"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "role_privileges_privilege" ADD CONSTRAINT "FK_d11ab7c8589ca17646c5345fb7f" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "role_privileges_privilege" ADD CONSTRAINT "FK_07bc07701aba37968ecf1f4ba19" FOREIGN KEY ("privilegeCode") REFERENCES "privilege"("code") ON DELETE CASCADE ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "edorg_closure" ADD CONSTRAINT "FK_b67fab0829f3b586fc9cd24cb93" FOREIGN KEY ("id_ancestor") REFERENCES "edorg"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "edorg_closure" ADD CONSTRAINT "FK_535b90f37f800a350ce4de5b90e" FOREIGN KEY ("id_descendant") REFERENCES "edorg"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );

    // Set up app privileges
    await queryRunner.query(
      `INSERT INTO "privilege" ("name", "code", "description")
      VALUES ('me:read', 'me:read', 'Read my own user information.'),
      ('ownership:read', 'ownership:read', 'Read ownerships in the global scope.'),
      ('ownership:update', 'ownership:update', 'Update ownerships in the global scope.'),
      ('ownership:delete', 'ownership:delete', 'Delete ownerships in the global scope.'),
      ('ownership:create', 'ownership:create', 'Create ownerships in the global scope.'),
      ('role:read', 'role:read', 'Read roles in the global scope.'),
      ('role:update', 'role:update', 'Update roles in the global scope.'),
      ('role:delete', 'role:delete', 'Delete roles in the global scope.'),
      ('role:create', 'role:create', 'Create roles in the global scope.'),
      ('sbe:read', 'sbe:read', 'Read Starting Blocks environments in the global scope.'),
      ('sbe:update', 'sbe:update', 'Update Starting Blocks environments in the global scope.'),
      ('sbe:delete', 'sbe:delete', 'Delete Starting Blocks environments in the global scope.'),
      ('sbe:create', 'sbe:create', 'Create Starting Blocks environments in the global scope.'),
      ('sbe:refresh-resources', 'sbe:refresh-resources', 'Sync Ed-Orgs and ODS''s for Starting Blocks environments in the global scope.'),
      ('ods:read', 'ods:read', 'Read ODS''s in the global scope.'),
      ('edorg:read', 'edorg:read', 'Read Ed-Orgs in the global scope.'),
      ('privilege:read', 'privilege:read', 'Read privileges in the global scope.'),
      ('user:read', 'user:read', 'Read users in the global scope.'),
      ('user:update', 'user:update', 'Update users in the global scope.'),
      ('user:delete', 'user:delete', 'Delete users in the global scope.'),
      ('user:create', 'user:create', 'Create users in the global scope.'),
      ('tenant:read', 'tenant:read', 'Read tenants in the global scope.'),
      ('tenant:update', 'tenant:update', 'Update tenants in the global scope.'),
      ('tenant:delete', 'tenant:delete', 'Delete tenants in the global scope.'),
      ('tenant:create', 'tenant:create', 'Create tenants in the global scope.'),
      ('user-tenant-membership:read', 'user-tenant-membership:read', 'Read user-tenant memberships in the global scope.'),
      ('user-tenant-membership:update', 'user-tenant-membership:update', 'Update user-tenant memberships in the global scope.'),
      ('user-tenant-membership:delete', 'user-tenant-membership:delete', 'Delete user-tenant memberships in the global scope.'),
      ('user-tenant-membership:create', 'user-tenant-membership:create', 'Create user-tenant memberships in the global scope.'),
      ('tenant.ownership:read', 'tenant.ownership:read', 'Read your tenant''s resource ownerships.'),
      ('tenant.role:read', 'tenant.role:read', 'Read your tenant''s roles.'),
      ('tenant.role:update', 'tenant.role:update', 'Update your tenant''s roles.'),
      ('tenant.role:delete', 'tenant.role:delete', 'Delete your tenant''s roles.'),
      ('tenant.role:create', 'tenant.role:create', 'Create your tenant''s roles.'),
      ('tenant.user:read', 'tenant.user:read', 'Read your tenant''s users.'),
      ('tenant.user-tenant-membership:read', 'tenant.user-tenant-membership:read', 'Read your tenant''s user memberships.'),
      ('tenant.user-tenant-membership:update', 'tenant.user-tenant-membership:update', 'Update your tenant''s user memberships.'),
      ('tenant.user-tenant-membership:delete', 'tenant.user-tenant-membership:delete', 'Delete your tenant''s user memberships.'),
      ('tenant.user-tenant-membership:create', 'tenant.user-tenant-membership:create', 'Create your tenant''s user memberships.'),
      ('tenant.sbe:read', 'tenant.sbe:read', 'Read your tenant''s Starting Blocks environments.'),
      ('tenant.sbe:refresh-resources', 'tenant.sbe:refresh-resources', 'Sync Ed-Orgs and ODS''s for your tenant''s Starting Blocks environments.'),
      ('tenant.sbe.vendor:read', 'tenant.sbe.vendor:read', 'Read your tenant''s vendors.'),
      ('tenant.sbe.vendor:update', 'tenant.sbe.vendor:update', 'Update your tenant''s vendors.'),
      ('tenant.sbe.vendor:delete', 'tenant.sbe.vendor:delete', 'Delete your tenant''s vendors.'),
      ('tenant.sbe.vendor:create', 'tenant.sbe.vendor:create', 'Create your tenant''s vendors.'),
      ('tenant.sbe.claimset:read', 'tenant.sbe.claimset:read', 'Read your tenant''s claim-sets.'),
      ('tenant.sbe.claimset:update', 'tenant.sbe.claimset:update', 'Update your tenant''s claim-sets.'),
      ('tenant.sbe.claimset:delete', 'tenant.sbe.claimset:delete', 'Delete your tenant''s claim-sets.'),
      ('tenant.sbe.claimset:create', 'tenant.sbe.claimset:create', 'Create your tenant''s claim-sets.'),
      ('tenant.sbe.ods:read', 'tenant.sbe.ods:read', 'Read your tenant''s ODS''s.'),
      ('tenant.sbe.edorg:read', 'tenant.sbe.edorg:read', 'Read your tenant''s Ed-Orgs.'),
      ('tenant.sbe.edorg.application:read', 'tenant.sbe.edorg.application:read', 'Read your tenant''s applications.'),
      ('tenant.sbe.edorg.application:update', 'tenant.sbe.edorg.application:update', 'Update your tenant''s applications.'),
      ('tenant.sbe.edorg.application:delete', 'tenant.sbe.edorg.application:delete', 'Delete your tenant''s applications.'),
      ('tenant.sbe.edorg.application:create', 'tenant.sbe.edorg.application:create', 'Create your tenant''s applications.'),
      ('tenant.sbe.edorg.application:reset-credentials', 'tenant.sbe.edorg.application:reset-credentials', 'Reset credentials for your tenant''s applications.');`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "edorg_closure" DROP CONSTRAINT "FK_535b90f37f800a350ce4de5b90e"`
    );
    await queryRunner.query(
      `ALTER TABLE "edorg_closure" DROP CONSTRAINT "FK_b67fab0829f3b586fc9cd24cb93"`
    );
    await queryRunner.query(
      `ALTER TABLE "role_privileges_privilege" DROP CONSTRAINT "FK_07bc07701aba37968ecf1f4ba19"`
    );
    await queryRunner.query(
      `ALTER TABLE "role_privileges_privilege" DROP CONSTRAINT "FK_d11ab7c8589ca17646c5345fb7f"`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "FK_091071fb2770f4bf2e3192e6192"`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "FK_29b0ffd913131cf5282742fa893"`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "FK_dcde9ae7d31fa30b2623697ff28"`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "FK_b09a0d360c3eeb7a25a598f04e4"`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "FK_1d4587643a7ce7fa5727816d7cc"`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "FK_b6c6688493760930cef57202552"`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "FK_cc065f6b477a818771878eeb628"`
    );
    await queryRunner.query(
      `ALTER TABLE "ownership" DROP CONSTRAINT "FK_9e38f4be50b8931ae3f2cc9468e"`
    );
    await queryRunner.query(`ALTER TABLE "role" DROP CONSTRAINT "FK_1751a572e91385a09d41c624714"`);
    await queryRunner.query(`ALTER TABLE "role" DROP CONSTRAINT "FK_c5d666dd8bf212b0d9ba353cb4f"`);
    await queryRunner.query(`ALTER TABLE "role" DROP CONSTRAINT "FK_30fe66100b98ed08e1c9fdee0e8"`);
    await queryRunner.query(`ALTER TABLE "role" DROP CONSTRAINT "FK_528f294633a808293425ae2ab56"`);
    await queryRunner.query(
      `ALTER TABLE "user_tenant_membership" DROP CONSTRAINT "FK_49e594e22dbe4c5e78689dbcb5e"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_tenant_membership" DROP CONSTRAINT "FK_825eb5ca32b71e4db155dc1b7c9"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_tenant_membership" DROP CONSTRAINT "FK_559208b256dbd6a371f121333e5"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_tenant_membership" DROP CONSTRAINT "FK_1d21629daa4dda26aedd2c3b03d"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_tenant_membership" DROP CONSTRAINT "FK_37a8b3d9ab253bcc6651a290013"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_tenant_membership" DROP CONSTRAINT "FK_c5b276250571c341867e2b7ca1c"`
    );
    await queryRunner.query(`ALTER TABLE "edorg" DROP CONSTRAINT "FK_bf2fe95bd8a50a2346489472df2"`);
    await queryRunner.query(`ALTER TABLE "edorg" DROP CONSTRAINT "FK_4f7237384382e4796332a25ea48"`);
    await queryRunner.query(`ALTER TABLE "edorg" DROP CONSTRAINT "FK_eacb927c57ecca3c22ab93fb849"`);
    await queryRunner.query(`ALTER TABLE "edorg" DROP CONSTRAINT "FK_00c8aa855170254728ee9fe3864"`);
    await queryRunner.query(`ALTER TABLE "edorg" DROP CONSTRAINT "FK_3e3a6841fcba09f3cf956944fa0"`);
    await queryRunner.query(`ALTER TABLE "edorg" DROP CONSTRAINT "FK_94e49b7b79f2b23d4685809c9e3"`);
    await queryRunner.query(`ALTER TABLE "sbe" DROP CONSTRAINT "FK_ab37768ff29885bd116f519bd3d"`);
    await queryRunner.query(`ALTER TABLE "sbe" DROP CONSTRAINT "FK_8f912321b2a5d074197d2169f72"`);
    await queryRunner.query(`ALTER TABLE "sbe" DROP CONSTRAINT "FK_ce4b1775b7e60418caa2df331a2"`);
    await queryRunner.query(`ALTER TABLE "ods" DROP CONSTRAINT "FK_829131f86e2d025918e2dee5a40"`);
    await queryRunner.query(`ALTER TABLE "ods" DROP CONSTRAINT "FK_cc1b217b80a24fd0031146c944a"`);
    await queryRunner.query(`ALTER TABLE "ods" DROP CONSTRAINT "FK_75491c4f18c4da07baa1da7f9c0"`);
    await queryRunner.query(`ALTER TABLE "ods" DROP CONSTRAINT "FK_fc6df40388b53b0603abb95846a"`);
    await queryRunner.query(
      `ALTER TABLE "tenant" DROP CONSTRAINT "FK_d5a26eda6ff5cef9bbff80770d6"`
    );
    await queryRunner.query(
      `ALTER TABLE "tenant" DROP CONSTRAINT "FK_1636cc00622963d7c7a5499312c"`
    );
    await queryRunner.query(
      `ALTER TABLE "tenant" DROP CONSTRAINT "FK_372fed256480b89aafbfb2f9e8b"`
    );
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_c28e52f758e7bbc53828db92194"`);
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_c3062c4102a912dfe7195a72bfb"`);
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_b7b62199aa0ff55f53e0137b217"`);
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_45c0d39d1f9ceeb56942db93cc5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_535b90f37f800a350ce4de5b90"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b67fab0829f3b586fc9cd24cb9"`);
    await queryRunner.query(`DROP TABLE "edorg_closure"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_07bc07701aba37968ecf1f4ba1"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d11ab7c8589ca17646c5345fb7"`);
    await queryRunner.query(`DROP TABLE "role_privileges_privilege"`);
    await queryRunner.query(`DROP TABLE "app_launcher"`);
    await queryRunner.query(`DROP TABLE "oidc"`);
    await queryRunner.query(`DROP TABLE "ownership"`);
    await queryRunner.query(`DROP TABLE "role"`);
    await queryRunner.query(`DROP TABLE "privilege"`);
    await queryRunner.query(`DROP TABLE "user_tenant_membership"`);
    await queryRunner.query(`DROP TABLE "edorg"`);
    await queryRunner.query(`DROP TABLE "sbe"`);
    await queryRunner.query(`DROP TABLE "ods"`);
    await queryRunner.query(`DROP TABLE "tenant"`);
    await queryRunner.query(`DROP TABLE "user"`);
  }
}
