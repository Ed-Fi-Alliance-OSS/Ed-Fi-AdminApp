import { MigrationInterface, QueryRunner } from 'typeorm';

export class V7Changes1709328882890 implements MigrationInterface {
  name = 'V7Changes1709328882890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // internalize privileges
    await queryRunner.query(
      `ALTER TABLE [role] ADD [privilegeIds] nvarchar(MAX) NOT NULL DEFAULT ''`
    );

    await queryRunner.query(`
        UPDATE [role]
        SET [privilegeIds] = (
          SELECT STRING_AGG([privilegeCode], ',')
          FROM [role_privileges_privilege]
          WHERE [role_privileges_privilege].[roleId] = [role].[id]
        )`);

    await queryRunner.query(`DROP TABLE [role_privileges_privilege]`);
    await queryRunner.query(`DROP TABLE [privilege]`);

    // rename tenant
    await queryRunner.query(`EXEC sp_rename '[role].[tenantId]', 'teamId', 'COLUMN'`);

    await queryRunner.query(`EXEC sp_rename '[ownership].[tenantId]', 'teamId', 'COLUMN'`);

    await queryRunner.query(`EXEC sp_rename '[tenant]', 'team'`);

    await queryRunner.query(`EXEC sp_rename '[user_tenant_membership]', 'user_team_membership'`);

    await queryRunner.query(`EXEC sp_rename '[user_team_membership].[tenantId]', 'teamId', 'COLUMN'`);



    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE([privilegeIds], 'tenant', 'team')`
    );
    await queryRunner.query(`UPDATE [role] SET [type] = 'UserTeam' WHERE [type] = 'UserTenant'`);

    // rename constraints (they're hashes of templated strings like sequence names above, and typeorm relies on that)
    await queryRunner.query(`ALTER TABLE [team] DROP CONSTRAINT [FK_1636cc00622963d7c7a5499312c]`);
    await queryRunner.query(`ALTER TABLE [team] DROP CONSTRAINT [FK_372fed256480b89aafbfb2f9e8b]`);
    await queryRunner.query(
      `ALTER TABLE [user_team_membership] DROP CONSTRAINT [FK_37a8b3d9ab253bcc6651a290013]`
    );
    await queryRunner.query(
      `ALTER TABLE [user_team_membership] DROP CONSTRAINT [FK_49e594e22dbe4c5e78689dbcb5e]`
    );
    await queryRunner.query(
      `ALTER TABLE [user_team_membership] DROP CONSTRAINT [FK_559208b256dbd6a371f121333e5]`
    );
    await queryRunner.query(
      `ALTER TABLE [user_team_membership] DROP CONSTRAINT [FK_825eb5ca32b71e4db155dc1b7c9]`
    );
    await queryRunner.query(
      `ALTER TABLE [user_team_membership] DROP CONSTRAINT [FK_c5b276250571c341867e2b7ca1c]`
    );
    await queryRunner.query(`ALTER TABLE [role] DROP CONSTRAINT [FK_1751a572e91385a09d41c624714]`);
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [FK_1d4587643a7ce7fa5727816d7cc]`
    );
    await queryRunner.query(
      `ALTER TABLE [user_team_membership] DROP CONSTRAINT [UQ_9f362212436320884321873e1fd]`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [UQ_03fd4f242cf59f808f69df949a1]`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [UQ_4f9d354f38493a53dd7b1a1b96e]`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [UQ_e81f6591816838e021ba3a4e110]`
    );

    await queryRunner.query(
      `ALTER TABLE [user_team_membership] ADD CONSTRAINT [UQ_fd1dcfae7e73c3d52a4b2d9df5e] UNIQUE ([teamId], [userId])`
    );

    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT [UQ_dd40433e091e5d45bec9b801d28] UNIQUE ([teamId], [edorgId])`
    );

    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT [UQ_dc1f1ddb60cb2358f424909bf7c] UNIQUE ([teamId], [odsId])`
    );

    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT [UQ_6963c608cdaa6f203b20eb938ed] UNIQUE ([teamId], [sbeId])`
    );

    await queryRunner.query(
      `ALTER TABLE [team] ADD CONSTRAINT [FK_3a93fbdeba4e1e9e47fec6bada9] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );

    await queryRunner.query(
      `ALTER TABLE [team] ADD CONSTRAINT [FK_4a6172bf2bf88b295a19b3245a7] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );

    await queryRunner.query(
      `ALTER TABLE [user_team_membership] ADD CONSTRAINT [FK_2454184e9011e28172f06d0d639] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );

    await queryRunner.query(
      `ALTER TABLE [user_team_membership] ADD CONSTRAINT [FK_978dfce88e15d0e7461b7350b1e] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );

    await queryRunner.query(
      `ALTER TABLE [user_team_membership] ADD CONSTRAINT [FK_e08e451152e4e3214301716d149] FOREIGN KEY ([teamId]) REFERENCES [team]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );

    await queryRunner.query(
      `ALTER TABLE [user_team_membership] ADD CONSTRAINT [FK_513e407d9457dc50784b4d9c20d] FOREIGN KEY ([userId]) REFERENCES [user]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );

    await queryRunner.query(
      `ALTER TABLE [user_team_membership] ADD CONSTRAINT [FK_ac0aaa143bbf1ee8725a6b1593e] FOREIGN KEY ([roleId]) REFERENCES [role]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );

    // Why would role depend on team? There might be something important here.
    // await queryRunner.query(
    //   `ALTER TABLE [role] ADD CONSTRAINT [FK_997dd31f342ad1e67a8dc9a24d1] FOREIGN KEY ([teamId]) REFERENCES [team]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    // );

    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT [FK_9ed3cde4307ca1cf1275e297152] FOREIGN KEY ([teamId]) REFERENCES [team]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    // rename sbe
    await queryRunner.query(`ALTER TABLE [ods] DROP CONSTRAINT [FK_829131f86e2d025918e2dee5a40]`);
    await queryRunner.query(`ALTER TABLE [edorg] DROP CONSTRAINT [FK_4f7237384382e4796332a25ea48]`);

    // This constraint no longer exists
    // await queryRunner.query(
    //   `ALTER TABLE [ownership] DROP CONSTRAINT [FK_dcde9ae7d31fa30b2623697ff28]`
    // );
    await queryRunner.query(`ALTER TABLE [edorg] DROP CONSTRAINT [UQ_07c5479767d3c27eb0150fee1d9]`);
    await queryRunner.query(
      `ALTER TABLE [ownership] DROP CONSTRAINT [UQ_6963c608cdaa6f203b20eb938ed]`
    );

    await queryRunner.query(`EXEC sp_rename '[sbe]', 'edfi_tenant'`);

    await queryRunner.query(`EXEC sp_rename '[ods].[sbeId]', 'edfiTenantId', 'COLUMN'`);
    await queryRunner.query(`EXEC sp_rename '[edorg].[sbeId]', 'edfiTenantId', 'COLUMN'`);
    await queryRunner.query(`EXEC sp_rename '[ownership].[sbeId]', 'edfiTenantId', 'COLUMN'`);

    await queryRunner.query(
      `ALTER TABLE [edorg] ADD CONSTRAINT [UQ_33c75697e30842d2559e910ffef] UNIQUE ([edfiTenantId], [odsId], [educationOrganizationId])`
    );
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT [UQ_0796c30d643a13b0a5489e1f7c3] UNIQUE ([teamId], [edfiTenantId])`
    );
    await queryRunner.query(
      `ALTER TABLE [ods] ADD CONSTRAINT [FK_21f00024e194f67e9f51575f750] FOREIGN KEY ([edfiTenantId]) REFERENCES [edfi_tenant]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );

    // edorg already depends on ods, therefore the following cascade is unnecessary. And MSSQL does not allow it anyway.
    // await queryRunner.query(
    //   `ALTER TABLE [edorg] ADD CONSTRAINT [FK_bce5c212f9dd8360f0bf8168ac9] FOREIGN KEY ([edfiTenantId]) REFERENCES [edfi_tenant]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    // );

    // Not sure what the problem is here. Need to evaluate the table structure
    // await queryRunner.query(
    //   `ALTER TABLE [ownership] ADD CONSTRAINT [FK_ce537e2505b0775277cf7e4a83d] FOREIGN KEY ([edfiTenantId]) REFERENCES [edfi_tenant]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    // );

    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] = REPLACE([privilegeIds], 'sbe', 'edfi-tenant')`
    );
    // add sb environment
    await queryRunner.query(
      `ALTER TABLE [edfi_tenant] DROP CONSTRAINT [FK_8f912321b2a5d074197d2169f72]`
    );
    await queryRunner.query(
      `ALTER TABLE [edfi_tenant] DROP CONSTRAINT [FK_ce4b1775b7e60418caa2df331a2]`
    );
    await queryRunner.query(
      `CREATE TABLE [sb_environment] ([id] INT IDENTITY(1,1) NOT NULL, [created] datetime2 NOT NULL DEFAULT getdate(), [modified] datetime2 NOT NULL DEFAULT getdate(), [createdById] integer, [modifiedById] integer, [envLabel] nvarchar(max), [name] nvarchar(max) NOT NULL, [configPublic] nvarchar(max), [configPrivate] nvarchar(max), CONSTRAINT [PK_9f51231184c890eb1d5b9d01758] PRIMARY KEY ([id]))`
    );
    await queryRunner.query(
      `SET IDENTITY_INSERT [sb_environment] ON;
      INSERT INTO [sb_environment] (
        [id], [name], [created], [modified], [createdById], [modifiedById], [envLabel], [configPublic], [configPrivate]
        ) SELECT
        [id], [name], [created], [modified], [createdById], [modifiedById], [envLabel], [configPublic], [configPrivate] FROM [edfi_tenant];
        SET IDENTITY_INSERT [sb_environment] OFF;`
    );
    await queryRunner.query(`ALTER TABLE [edfi_tenant] ADD [sbEnvironmentId] INT NULL`);
    await queryRunner.query(`UPDATE [edfi_tenant] SET [sbEnvironmentId] = [id]`);
    await queryRunner.query(
      `ALTER TABLE [edfi_tenant] ALTER COLUMN [sbEnvironmentId] INT NOT NULL`
    );
    await queryRunner.query(`UPDATE [edfi_tenant] SET [name] = 'default'`);
    await queryRunner.query(`ALTER TABLE [edfi_tenant] DROP COLUMN [envLabel]`);
    await queryRunner.query(`ALTER TABLE [edfi_tenant] DROP COLUMN [configPrivate]`);
    await queryRunner.query(`ALTER TABLE [edfi_tenant] DROP COLUMN [configPublic]`);
    await queryRunner.query(`ALTER TABLE [ownership] ADD [sbEnvironmentId] integer`);
    // These constraints no longer exists
    // await queryRunner.query(`ALTER TABLE [edorg] DROP CONSTRAINT [FK_bce5c212f9dd8360f0bf8168ac9]`);
    // await queryRunner.query(
    //   `ALTER TABLE [ownership] DROP CONSTRAINT [FK_ce537e2505b0775277cf7e4a83d]`
    // );
    await queryRunner.query(`ALTER TABLE [ods] DROP CONSTRAINT [FK_21f00024e194f67e9f51575f750]`);
    await queryRunner.query(`EXEC sp_addextendedproperty
@name = N'MS_Description', @value = 'The name used in the tenant management database in StartingBlocks',
@level0type = N'Schema', @level0name = dbo,
@level1type = N'Table',  @level1name = 'edfi_tenant',
@level2type = N'Column', @level2name = 'name';`
    );
    await queryRunner.query(
      `ALTER TABLE [ods] ADD CONSTRAINT [FK_21f00024e194f67e9f51575f750] FOREIGN KEY ([edfiTenantId]) REFERENCES [edfi_tenant]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [edfi_tenant] ADD CONSTRAINT [FK_77c6bec8378354712fac1f4ed9e] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [edfi_tenant] ADD CONSTRAINT [FK_e1ebbdef1ca79a15f84673c8c04] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [edfi_tenant] ADD CONSTRAINT [FK_becbb52581423083ffcf053733a] FOREIGN KEY ([sbEnvironmentId]) REFERENCES [sb_environment]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    // Bad constraints
    // await queryRunner.query(
    //   `ALTER TABLE [edorg] ADD CONSTRAINT [FK_bce5c212f9dd8360f0bf8168ac9] FOREIGN KEY ([edfiTenantId]) REFERENCES [edfi_tenant]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    // );
    // await queryRunner.query(
    //   `ALTER TABLE [ownership] ADD CONSTRAINT [FK_fe36fa53d8f494740a5af704430] FOREIGN KEY ([sbEnvironmentId]) REFERENCES [sb_environment]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    // );
    // await queryRunner.query(
    //   `ALTER TABLE [ownership] ADD CONSTRAINT [FK_ce537e2505b0775277cf7e4a83d] FOREIGN KEY ([edfiTenantId]) REFERENCES [edfi_tenant]([id]) ON DELETE CASCADE ON UPDATE NO ACTION`
    // );
    await queryRunner.query(
      `ALTER TABLE [sb_environment] ADD CONSTRAINT [FK_9689609f9a1151c15e0fd46044e] FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE [sb_environment] ADD CONSTRAINT [FK_d31c6bd5a79862649f2407ff3ac] FOREIGN KEY ([modifiedById]) REFERENCES [user]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    // migrate privileges
    await queryRunner.query(
      `UPDATE role SET [privilegeIds] = replace([privilegeIds], 'edfi-tenant', 'sb-environment.edfi-tenant')`
    );
    await queryRunner.query(
      `UPDATE role SET [privilegeIds] = replace([privilegeIds], 'edfi-tenant.edorg', 'edfi-tenant.ods.edorg')`
    );

    // For each role, if privilegeIds contains '.edfi-tenant:', append replacements
    await queryRunner.query(`
      DECLARE @id INT, @privilegeIds NVARCHAR(MAX), @newPrivileges NVARCHAR(MAX);

      DECLARE role_cursor CURSOR FOR
        SELECT [id], [privilegeIds] FROM [role];

      OPEN role_cursor;
      FETCH NEXT FROM role_cursor INTO @id, @privilegeIds;

      WHILE @@FETCH_STATUS = 0
      BEGIN
        IF CHARINDEX('.edfi-tenant:', @privilegeIds) > 0
        BEGIN
          -- Replace all .edfi-tenant: with : in the privilegeIds string
          SET @newPrivileges = REPLACE(@privilegeIds, '.edfi-tenant:', ':');

          -- Concatenate the new privileges to the original privilegeIds
          UPDATE [role]
          SET [privilegeIds] = @privilegeIds + ',' + @newPrivileges
          WHERE [id] = @id;
        END

        FETCH NEXT FROM role_cursor INTO @id, @privilegeIds;
      END

      CLOSE role_cursor;
      DEALLOCATE role_cursor;
    `);

    // denormalize sbEnvironmentId
    await queryRunner.query(`ALTER TABLE [ods] ADD [sbEnvironmentId] INT NULL`);
    await queryRunner.query(`ALTER TABLE [edorg] ADD [sbEnvironmentId] INT NULL`);

    await queryRunner.query(
      `UPDATE [ods] SET [sbEnvironmentId] = [edfi_tenant].[sbEnvironmentId] FROM [edfi_tenant] WHERE [ods].[edfiTenantId] = [edfi_tenant].[id]`
    );
    await queryRunner.query(
      `UPDATE [edorg] SET [sbEnvironmentId] = [edfi_tenant].[sbEnvironmentId] FROM [edfi_tenant] WHERE [edorg].[edfiTenantId] = [edfi_tenant].[id]`
    );

    await queryRunner.query(`ALTER TABLE [ods] ALTER COLUMN [sbEnvironmentId] INT NOT NULL`);
    await queryRunner.query(`ALTER TABLE [edorg] ALTER COLUMN [sbEnvironmentId] INT NOT NULL`);

    await queryRunner.query(`ALTER TABLE [ods] ADD [odsInstanceId] INT NULL`);
    await queryRunner.query(`ALTER TABLE [edorg] ADD [odsInstanceId] INT NULL`);
    await queryRunner.query(`EXEC sp_updateextendedproperty
@name = N'MS_Description', @value = 'The name used in the tenant management database in StartingBlocks, or "default" for v5/6 environments',
@level0type = N'Schema', @level0name = dbo,
@level1type = N'Table',  @level1name = 'edfi_tenant',
@level2type = N'Column', @level2name = 'name';`
    );
    await queryRunner.query(`EXEC sp_addextendedproperty
@name = N'MS_Description', @value = 'Pre-v7/v2, this reliably included the Ods name. In v7/v2 it is no longer alone sufficient as a natural key, and must be combined with an ODS identifier.',
@level0type = N'Schema', @level0name = dbo,
@level1type = N'Table',  @level1name = 'edorg',
@level2type = N'Column', @level2name = 'educationOrganizationId';`
    );
    // migrate sbe config
    await queryRunner.query(
      `UPDATE [sb_environment]
      SET [configPublic] = JSON_OBJECT(
        'sbEnvironmentMetaArn':JSON_VALUE([configPublic], '$.sbeMetaArn'),
        'adminApiUrl':JSON_VALUE([configPublic], '$.adminApiUrl'),
        'version':'v1',
        'values':JSON_OBJECT(
          'adminApiKey':JSON_VALUE([configPublic], '$.adminApiKey'),
          'adminApiUrl':JSON_VALUE([configPublic], '$.adminApiUrl'),
          'edfiHostname':JSON_VALUE([configPublic], '$.edfiHostname'),
          'adminApiClientDisplayName':JSON_VALUE([configPublic], '$.adminApiClientDisplayName')
        )
      )
      WHERE JSON_VALUE([configPublic], '$.sbeMetaArn') IS NOT NULL OR JSON_VALUE([configPublic], '$.adminApiUrl') IS NOT NULL;`
    );
    // ownership sb unique
    await queryRunner.query(
      `ALTER TABLE [ownership] ADD CONSTRAINT [UQ_99758503ba9f18ec99ab8d72384] UNIQUE ("teamId", [sbEnvironmentId])`
    );
    // tweak tenant crud privileges
    await queryRunner.query(
      `UPDATE [role] SET [privilegeIds] =
        replace(
          replace(
            replace(
              [privilegeIds], 'team.sb-environment.edfi-tenant:refresh-resources',''
            ),
            'team.sb-environment:refresh-resources',''
          ),
          ',,', ','
        )`
        // The last strange line is in case the replacement left any ",," double commas behind
    );
    // add ownership view
    await queryRunner.query(`CREATE VIEW [ownership_view] AS SELECT ownership.[id],
            ownership.[teamId],
            ownership.[roleId],
            CASE
                WHEN [ownership].[edorgId] IS NOT NULL then 'Edorg'
                WHEN ownership.[odsId] IS NOT NULL THEN 'Ods'
                WHEN ownership.[edfiTenantId] IS NOT NULL THEN 'EdfiTenant'
                ELSE 'SbEnvironment'
            END as [resourceType],
            sb_environment.name +
              CASE
                WHEN edfi_tenant.[name] IS NOT NULL THEN ' / ' + edfi_tenant.[name]
                ELSE ''
              END +
              CASE
                WHEN ods.[dbName] IS NOT NULL THEN ' / ' + ods.[dbName]
                ELSE ''
              END +
              CASE
                WHEN edorg.[shortNameOfInstitution] IS NOT NULL THEN ' / ' + edorg.[shortNameOfInstitution]
                ELSE ''
              END as [resourceText]
            FROM ownership
              LEFT JOIN edorg ON ownership.[edorgId] = edorg.id
              LEFT JOIN ods ON ownership.[odsId] = ods.id OR edorg.[odsId] = ods.id
              LEFT JOIN edfi_tenant ON ownership.[edfiTenantId] = edfi_tenant.id OR ods.[edfiTenantId] = edfi_tenant.id
              LEFT JOIN sb_environment ON ownership.[sbEnvironmentId] = sb_environment.id or
                                          edfi_tenant.[sbEnvironmentId] = sb_environment.id`);
    await queryRunner.query(
      `INSERT INTO [typeorm_metadata]([schema], [type], [name], [value]) VALUES ($1, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'ownership_view',
        'SELECT ownership.[id],\nownership.[teamId],\nownership.[roleId],\nCASE\n    WHEN [ownership].[edorgId] IS NOT NULL then \'Edorg\'\n    WHEN ownership.[odsId] IS NOT NULL THEN \'Ods\'\n    WHEN ownership.[edfiTenantId] IS NOT NULL THEN \'EdfiTenant\'\n    ELSE \'SbEnvironment\' END "resourceType",\nsb_environment.name +\nCASE WHEN edfi_tenant.[name] IS NOT NULL THEN \' / \' + edfi_tenant.[name] ELSE \'\' END +\nCASE WHEN ods.[dbName] IS NOT NULL THEN \' / \' + ods.[dbName] ELSE \'\' END +\nCASE\n    WHEN edorg.[shortNameOfInstitution] IS NOT NULL THEN \' / \' + edorg.[shortNameOfInstitution]\n    ELSE \'\' END              "resourceText"\nFROM ownership\n  LEFT JOIN edorg ON ownership.[edorgId] = edorg.id\n  LEFT JOIN ods ON ownership.[odsId] = ods.id OR edorg.[odsId] = ods.id\n  LEFT JOIN edfi_tenant ON ownership.[edfiTenantId] = edfi_tenant.id OR ods.[edfiTenantId] = edfi_tenant.id\n  LEFT JOIN sb_environment ON ownership.[sbEnvironmentId] = sb_environment.id or\n                              edfi_tenant.[sbEnvironmentId] = sb_environment.id',
      ]
    );
    // new sb sync queue
    await queryRunner.query(
      `DELETE FROM [typeorm_metadata] WHERE [type] = $1 AND [name] = $2 AND [schema] = $3`,
      ['VIEW', 'sb_sync_queue', 'public']
    );

    // Here the Postgresql created a materialized view "sb_sync_queue". This
    // will need to be created in the future, as we're not ready to support an
    // MSSQL equivalent to pgboss
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    throw new Error('v7 changes are not reversible. Please restore from backup.');
  }
}
