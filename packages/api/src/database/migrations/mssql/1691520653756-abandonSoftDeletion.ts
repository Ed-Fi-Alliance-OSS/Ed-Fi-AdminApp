import { MigrationInterface, QueryRunner } from 'typeorm';

export class AbandonSoftDeletion1691520653756 implements MigrationInterface {
  name = 'AbandonSoftDeletion1691520653756';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // remove deletedBy FKs
  await queryRunner.query(`ALTER TABLE [user] DROP CONSTRAINT [FK_c3062c4102a912dfe7195a72bfb]`);
    await queryRunner.query(
      `ALTER TABLE [tenant] DROP CONSTRAINT [FK_d5a26eda6ff5cef9bbff80770d6]`
    );
  await queryRunner.query(`ALTER TABLE [ods] DROP CONSTRAINT [FK_cc1b217b80a24fd0031146c944a]`);
  await queryRunner.query(`ALTER TABLE [sbe] DROP CONSTRAINT [FK_ab37768ff29885bd116f519bd3d]`);
  await queryRunner.query(`ALTER TABLE [edorg] DROP CONSTRAINT [FK_00c8aa855170254728ee9fe3864]`);
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] DROP CONSTRAINT [FK_1d21629daa4dda26aedd2c3b03d]`
    );
  await queryRunner.query(`ALTER TABLE [role] DROP CONSTRAINT [FK_c5d666dd8bf212b0d9ba353cb4f]`);
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [FK_b6c6688493760930cef57202552]`
    );

    // remove normal relationship FKs...
  await queryRunner.query(`ALTER TABLE [ods] DROP CONSTRAINT [FK_829131f86e2d025918e2dee5a40]`);
  await queryRunner.query(`ALTER TABLE [edorg] DROP CONSTRAINT [FK_eacb927c57ecca3c22ab93fb849]`);
  await queryRunner.query(`ALTER TABLE [edorg] DROP CONSTRAINT [FK_4f7237384382e4796332a25ea48]`);
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] DROP CONSTRAINT [FK_559208b256dbd6a371f121333e5]`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] DROP CONSTRAINT [FK_825eb5ca32b71e4db155dc1b7c9]`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] DROP CONSTRAINT [FK_49e594e22dbe4c5e78689dbcb5e]`
    );
  await queryRunner.query(`ALTER TABLE [role] DROP CONSTRAINT [FK_1751a572e91385a09d41c624714]`);
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [FK_1d4587643a7ce7fa5727816d7cc]`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT "FK_dcde9ae7d31fa30b2623697ff28"`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT "FK_29b0ffd913131cf5282742fa893"`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT "FK_091071fb2770f4bf2e3192e6192"`
    );

    // ...then add them back with cascades
    await queryRunner.query(
      `ALTER TABLE [ods] ADD CONSTRAINT "FK_829131f86e2d025918e2dee5a40" FOREIGN KEY ([sbeId]) REFERENCES [sbe]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [edorg] ADD CONSTRAINT "FK_eacb927c57ecca3c22ab93fb849" FOREIGN KEY ([odsId]) REFERENCES [ods]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [edorg] ADD CONSTRAINT "FK_4f7237384382e4796332a25ea48" FOREIGN KEY ([sbeId]) REFERENCES [sbe]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] ADD CONSTRAINT "FK_559208b256dbd6a371f121333e5" FOREIGN KEY ([tenantId]) REFERENCES [tenant]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] ADD CONSTRAINT "FK_825eb5ca32b71e4db155dc1b7c9" FOREIGN KEY ([userId]) REFERENCES [user]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] ADD CONSTRAINT "FK_49e594e22dbe4c5e78689dbcb5e" FOREIGN KEY ([roleId]) REFERENCES [role]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [role] ADD CONSTRAINT "FK_1751a572e91385a09d41c624714" FOREIGN KEY ([tenantId]) REFERENCES [tenant]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT "FK_1d4587643a7ce7fa5727816d7cc" FOREIGN KEY ([tenantId]) REFERENCES [tenant]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT "FK_dcde9ae7d31fa30b2623697ff28" FOREIGN KEY ([sbeId]) REFERENCES [sbe]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT "FK_29b0ffd913131cf5282742fa893" FOREIGN KEY ([odsId]) REFERENCES [ods]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT "FK_091071fb2770f4bf2e3192e6192" FOREIGN KEY ([edorgId]) REFERENCES [edorg]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );

    // remove soft-deleted records
    await queryRunner.query(`DELETE FROM [user_tenant_membership] WHERE [deleted] is not null`);
    await queryRunner.query(`DELETE FROM [ownership] WHERE [deleted] is not null`);
    await queryRunner.query(`DELETE FROM [tenant] WHERE [deleted] is not null`);
    await queryRunner.query(`DELETE FROM [role] WHERE [deleted] is not null`);
    await queryRunner.query(`DELETE FROM [edorg] WHERE [deleted] is not null`);
    await queryRunner.query(`DELETE FROM [ods] WHERE [deleted] is not null`);
    await queryRunner.query(`DELETE FROM [sbe] WHERE [deleted] is not null`);
    await queryRunner.query(`DELETE FROM [user] WHERE [deleted] is not null`);

    // drop columns and remove soft-delete column from unique constraints
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT "UQ_381c84f400fe4380394f7a410a7"`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT "UQ_c17a51e3854b3e05c8edfb0d3c8"`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT "UQ_14d955adf701aad1310e1342370"`
    );
    await queryRunner.query(`ALTER TABLE [user] DROP COLUMN [deleted]`);
    await queryRunner.query(`ALTER TABLE [user] DROP COLUMN "deletedById"`);
    await queryRunner.query(`ALTER TABLE [tenant] DROP COLUMN [deleted]`);
    await queryRunner.query(`ALTER TABLE [tenant] DROP COLUMN "deletedById"`);
    await queryRunner.query(`ALTER TABLE [ods] DROP COLUMN [deleted]`);
    await queryRunner.query(`ALTER TABLE [ods] DROP COLUMN "deletedById"`);
    await queryRunner.query(`ALTER TABLE [sbe] DROP COLUMN [deleted]`);
    await queryRunner.query(`ALTER TABLE [sbe] DROP COLUMN "deletedById"`);
    await queryRunner.query(`ALTER TABLE [edorg] DROP COLUMN [deleted]`);
    await queryRunner.query(`ALTER TABLE [edorg] DROP COLUMN "deletedById"`);
    await queryRunner.query(`ALTER TABLE [user_tenant_membership] DROP COLUMN [deleted]`);
    await queryRunner.query(`ALTER TABLE [user_tenant_membership] DROP COLUMN "deletedById"`);
    await queryRunner.query(`ALTER TABLE [role] DROP COLUMN [deleted]`);
    await queryRunner.query(`ALTER TABLE [role] DROP COLUMN "deletedById"`);
    await queryRunner.query(`ALTER TABLE [ownership] DROP COLUMN [deleted]`);
    await queryRunner.query(`ALTER TABLE [ownership] DROP COLUMN "deletedById"`);
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT "UQ_e81f6591816838e021ba3a4e110" UNIQUE ([tenantId], [edorgId])`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT "UQ_4f9d354f38493a53dd7b1a1b96e" UNIQUE ([tenantId], [odsId])`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT "UQ_03fd4f242cf59f808f69df949a1" UNIQUE ([tenantId], [sbeId])`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT "FK_091071fb2770f4bf2e3192e6192"`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT "FK_29b0ffd913131cf5282742fa893"`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT "FK_dcde9ae7d31fa30b2623697ff28"`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT "FK_1d4587643a7ce7fa5727816d7cc"`
    );
    await queryRunner.query(`ALTER TABLE [role] DROP CONSTRAINT "FK_1751a572e91385a09d41c624714"`);
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] DROP CONSTRAINT "FK_49e594e22dbe4c5e78689dbcb5e"`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] DROP CONSTRAINT "FK_825eb5ca32b71e4db155dc1b7c9"`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] DROP CONSTRAINT "FK_559208b256dbd6a371f121333e5"`
    );
    await queryRunner.query(`ALTER TABLE [edorg] DROP CONSTRAINT "FK_4f7237384382e4796332a25ea48"`);
    await queryRunner.query(`ALTER TABLE [edorg] DROP CONSTRAINT "FK_eacb927c57ecca3c22ab93fb849"`);
    await queryRunner.query(`ALTER TABLE [ods] DROP CONSTRAINT "FK_829131f86e2d025918e2dee5a40"`);
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT "UQ_03fd4f242cf59f808f69df949a1"`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT "UQ_4f9d354f38493a53dd7b1a1b96e"`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT "UQ_e81f6591816838e021ba3a4e110"`
    );
    await queryRunner.query(`ALTER TABLE [ownership] ADD "deletedById" integer`);
    await queryRunner.query(`ALTER TABLE [ownership] ADD [deleted] TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE [role] ADD "deletedById" integer`);
    await queryRunner.query(`ALTER TABLE [role] ADD [deleted] TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE [user_tenant_membership] ADD "deletedById" integer`);
    await queryRunner.query(`ALTER TABLE [user_tenant_membership] ADD [deleted] TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE [edorg] ADD "deletedById" integer`);
    await queryRunner.query(`ALTER TABLE [edorg] ADD [deleted] TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE [sbe] ADD "deletedById" integer`);
    await queryRunner.query(`ALTER TABLE [sbe] ADD [deleted] TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE [ods] ADD "deletedById" integer`);
    await queryRunner.query(`ALTER TABLE [ods] ADD [deleted] TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE [tenant] ADD "deletedById" integer`);
    await queryRunner.query(`ALTER TABLE [tenant] ADD [deleted] TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE [user] ADD "deletedById" integer`);
    await queryRunner.query(`ALTER TABLE [user] ADD [deleted] TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT "UQ_14d955adf701aad1310e1342370" UNIQUE ([deleted], [tenantId], [sbeId])`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT "UQ_c17a51e3854b3e05c8edfb0d3c8" UNIQUE ([deleted], [tenantId], [odsId])`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT "UQ_381c84f400fe4380394f7a410a7" UNIQUE ([deleted], [tenantId], [edorgId])`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT "FK_091071fb2770f4bf2e3192e6192" FOREIGN KEY ([edorgId]) REFERENCES [edorg]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT "FK_29b0ffd913131cf5282742fa893" FOREIGN KEY ([odsId]) REFERENCES [ods]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT "FK_dcde9ae7d31fa30b2623697ff28" FOREIGN KEY ([sbeId]) REFERENCES [sbe]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT "FK_1d4587643a7ce7fa5727816d7cc" FOREIGN KEY ([tenantId]) REFERENCES [tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT "FK_b6c6688493760930cef57202552" FOREIGN KEY ("deletedById") REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [role] ADD CONSTRAINT "FK_1751a572e91385a09d41c624714" FOREIGN KEY ([tenantId]) REFERENCES [tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [role] ADD CONSTRAINT "FK_c5d666dd8bf212b0d9ba353cb4f" FOREIGN KEY ("deletedById") REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] ADD CONSTRAINT "FK_49e594e22dbe4c5e78689dbcb5e" FOREIGN KEY ([roleId]) REFERENCES [role]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] ADD CONSTRAINT "FK_825eb5ca32b71e4db155dc1b7c9" FOREIGN KEY ([userId]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] ADD CONSTRAINT "FK_559208b256dbd6a371f121333e5" FOREIGN KEY ([tenantId]) REFERENCES [tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] ADD CONSTRAINT "FK_1d21629daa4dda26aedd2c3b03d" FOREIGN KEY ("deletedById") REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [edorg] ADD CONSTRAINT "FK_4f7237384382e4796332a25ea48" FOREIGN KEY ([sbeId]) REFERENCES [sbe]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [edorg] ADD CONSTRAINT "FK_eacb927c57ecca3c22ab93fb849" FOREIGN KEY ([odsId]) REFERENCES [ods]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [edorg] ADD CONSTRAINT "FK_00c8aa855170254728ee9fe3864" FOREIGN KEY ("deletedById") REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [sbe] ADD CONSTRAINT "FK_ab37768ff29885bd116f519bd3d" FOREIGN KEY ("deletedById") REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [ods] ADD CONSTRAINT "FK_829131f86e2d025918e2dee5a40" FOREIGN KEY ([sbeId]) REFERENCES [sbe]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [ods] ADD CONSTRAINT "FK_cc1b217b80a24fd0031146c944a" FOREIGN KEY ("deletedById") REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [tenant] ADD CONSTRAINT "FK_d5a26eda6ff5cef9bbff80770d6" FOREIGN KEY ("deletedById") REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [user] ADD CONSTRAINT "FK_c3062c4102a912dfe7195a72bfb" FOREIGN KEY ("deletedById") REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
