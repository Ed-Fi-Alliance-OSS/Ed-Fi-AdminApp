import { MigrationInterface, QueryRunner } from 'typeorm';

export class FkOnDeleteTweaks1693514948085 implements MigrationInterface {
  name = 'FkOnDeleteTweaks1693514948085';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // It looks like a ton of changes, but it's all just inherited from modifying the two User-referencing fields on EntityBase.

    await queryRunner.query(`ALTER TABLE [user] DROP CONSTRAINT [FK_45c0d39d1f9ceeb56942db93cc5]`);
    await queryRunner.query(`ALTER TABLE [user] DROP CONSTRAINT [FK_b7b62199aa0ff55f53e0137b217]`);
    await queryRunner.query(`ALTER TABLE [user] DROP CONSTRAINT [FK_c28e52f758e7bbc53828db92194]`);
    await queryRunner.query(
      `ALTER TABLE [tenant] DROP CONSTRAINT [FK_372fed256480b89aafbfb2f9e8b]`
    );
    await queryRunner.query(
      `ALTER TABLE [tenant] DROP CONSTRAINT [FK_1636cc00622963d7c7a5499312c]`
    );
    await queryRunner.query(`ALTER TABLE [ods] DROP CONSTRAINT [FK_fc6df40388b53b0603abb95846a]`);
    await queryRunner.query(`ALTER TABLE [ods] DROP CONSTRAINT [FK_75491c4f18c4da07baa1da7f9c0]`);
    await queryRunner.query(`ALTER TABLE [sbe] DROP CONSTRAINT [FK_ce4b1775b7e60418caa2df331a2]`);
    await queryRunner.query(`ALTER TABLE [sbe] DROP CONSTRAINT [FK_8f912321b2a5d074197d2169f72]`);
    await queryRunner.query(`ALTER TABLE [edorg] DROP CONSTRAINT [FK_94e49b7b79f2b23d4685809c9e3]`);
    await queryRunner.query(`ALTER TABLE [edorg] DROP CONSTRAINT [FK_3e3a6841fcba09f3cf956944fa0]`);
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] DROP CONSTRAINT [FK_c5b276250571c341867e2b7ca1c]`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] DROP CONSTRAINT [FK_37a8b3d9ab253bcc6651a290013]`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] DROP CONSTRAINT [FK_49e594e22dbe4c5e78689dbcb5e]`
    );
    await queryRunner.query(`ALTER TABLE [role] DROP CONSTRAINT [FK_528f294633a808293425ae2ab56]`);
    await queryRunner.query(`ALTER TABLE [role] DROP CONSTRAINT [FK_30fe66100b98ed08e1c9fdee0e8]`);
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [FK_9e38f4be50b8931ae3f2cc9468e]`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [FK_cc065f6b477a818771878eeb628]`
    );

    // user.createdbyId --> user.id. Cyclic deletes again. We should be disabling users, not deleting them. And certainly need to not cascade.
    // or need to record the username instead of userid and not have a foreign key. For now, just comment out
    // await queryRunner.query(
    //   `ALTER TABLE [user] ADD CONSTRAINT [FK_45c0d39d1f9ceeb56942db93cc5] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    // );
    // await queryRunner.query(
    //   `ALTER TABLE [user] ADD CONSTRAINT [FK_b7b62199aa0ff55f53e0137b217] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    // );

    await queryRunner.query(
      `ALTER TABLE [user] ADD CONSTRAINT [FK_c28e52f758e7bbc53828db92194] FOREIGN KEY ([roleId]) REFERENCES [role]([id]) ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [tenant] ADD CONSTRAINT [FK_372fed256480b89aafbfb2f9e8b] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );

    // In the PostgreSQL original, deleting from `user` causes the createdById and modifiedById values to be set to null. But MSSQL won't let us have
    // two cascading deletes between the two tables, so this pattern won't work. Changing to NO ACTION probably breaks the ability to delete users.
    // Trying it for now just to move through the SQL script corrections, and then come back to find a better way.
    await queryRunner.query(
      `ALTER TABLE [tenant] ADD CONSTRAINT [FK_1636cc00622963d7c7a5499312c] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [ods] ADD CONSTRAINT [FK_fc6df40388b53b0603abb95846a] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [ods] ADD CONSTRAINT [FK_75491c4f18c4da07baa1da7f9c0] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [sbe] ADD CONSTRAINT [FK_ce4b1775b7e60418caa2df331a2] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [sbe] ADD CONSTRAINT [FK_8f912321b2a5d074197d2169f72] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [edorg] ADD CONSTRAINT [FK_94e49b7b79f2b23d4685809c9e3] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [edorg] ADD CONSTRAINT [FK_3e3a6841fcba09f3cf956944fa0] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] ADD CONSTRAINT [FK_c5b276250571c341867e2b7ca1c] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] ADD CONSTRAINT [FK_37a8b3d9ab253bcc6651a290013] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] ADD CONSTRAINT [FK_49e594e22dbe4c5e78689dbcb5e] FOREIGN KEY ([roleId]) REFERENCES [role]([id]) ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [role] ADD CONSTRAINT [FK_528f294633a808293425ae2ab56] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [role] ADD CONSTRAINT [FK_30fe66100b98ed08e1c9fdee0e8] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT [FK_9e38f4be50b8931ae3f2cc9468e] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT [FK_cc065f6b477a818771878eeb628] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [FK_cc065f6b477a818771878eeb628]`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [FK_9e38f4be50b8931ae3f2cc9468e]`
    );
    await queryRunner.query(`ALTER TABLE [role] DROP CONSTRAINT [FK_30fe66100b98ed08e1c9fdee0e8]`);
    await queryRunner.query(`ALTER TABLE [role] DROP CONSTRAINT [FK_528f294633a808293425ae2ab56]`);
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] DROP CONSTRAINT [FK_49e594e22dbe4c5e78689dbcb5e]`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] DROP CONSTRAINT [FK_37a8b3d9ab253bcc6651a290013]`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] DROP CONSTRAINT [FK_c5b276250571c341867e2b7ca1c]`
    );
    await queryRunner.query(`ALTER TABLE [edorg] DROP CONSTRAINT [FK_3e3a6841fcba09f3cf956944fa0]`);
    await queryRunner.query(`ALTER TABLE [edorg] DROP CONSTRAINT [FK_94e49b7b79f2b23d4685809c9e3]`);
    await queryRunner.query(`ALTER TABLE [sbe] DROP CONSTRAINT [FK_8f912321b2a5d074197d2169f72]`);
    await queryRunner.query(`ALTER TABLE [sbe] DROP CONSTRAINT [FK_ce4b1775b7e60418caa2df331a2]`);
    await queryRunner.query(`ALTER TABLE [ods] DROP CONSTRAINT [FK_75491c4f18c4da07baa1da7f9c0]`);
    await queryRunner.query(`ALTER TABLE [ods] DROP CONSTRAINT [FK_fc6df40388b53b0603abb95846a]`);
    await queryRunner.query(
      `ALTER TABLE [tenant] DROP CONSTRAINT [FK_1636cc00622963d7c7a5499312c]`
    );
    await queryRunner.query(
      `ALTER TABLE [tenant] DROP CONSTRAINT [FK_372fed256480b89aafbfb2f9e8b]`
    );
    await queryRunner.query(`ALTER TABLE [user] DROP CONSTRAINT [FK_c28e52f758e7bbc53828db92194]`);
    await queryRunner.query(`ALTER TABLE [user] DROP CONSTRAINT [FK_b7b62199aa0ff55f53e0137b217]`);
    await queryRunner.query(`ALTER TABLE [user] DROP CONSTRAINT [FK_45c0d39d1f9ceeb56942db93cc5]`);
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT [FK_cc065f6b477a818771878eeb628] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT [FK_9e38f4be50b8931ae3f2cc9468e] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [role] ADD CONSTRAINT [FK_30fe66100b98ed08e1c9fdee0e8] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [role] ADD CONSTRAINT [FK_528f294633a808293425ae2ab56] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] ADD CONSTRAINT [FK_49e594e22dbe4c5e78689dbcb5e] FOREIGN KEY ([roleId]) REFERENCES [role]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] ADD CONSTRAINT [FK_37a8b3d9ab253bcc6651a290013] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [user_tenant_membership] ADD CONSTRAINT [FK_c5b276250571c341867e2b7ca1c] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [edorg] ADD CONSTRAINT [FK_3e3a6841fcba09f3cf956944fa0] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [edorg] ADD CONSTRAINT [FK_94e49b7b79f2b23d4685809c9e3] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [sbe] ADD CONSTRAINT [FK_8f912321b2a5d074197d2169f72] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [sbe] ADD CONSTRAINT [FK_ce4b1775b7e60418caa2df331a2] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [ods] ADD CONSTRAINT [FK_75491c4f18c4da07baa1da7f9c0] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [ods] ADD CONSTRAINT [FK_fc6df40388b53b0603abb95846a] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [tenant] ADD CONSTRAINT [FK_1636cc00622963d7c7a5499312c] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [tenant] ADD CONSTRAINT [FK_372fed256480b89aafbfb2f9e8b] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [user] ADD CONSTRAINT [FK_c28e52f758e7bbc53828db92194] FOREIGN KEY ([roleId]) REFERENCES [role]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [user] ADD CONSTRAINT [FK_b7b62199aa0ff55f53e0137b217] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [user] ADD CONSTRAINT [FK_45c0d39d1f9ceeb56942db93cc5] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
