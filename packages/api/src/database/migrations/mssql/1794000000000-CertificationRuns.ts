import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AC-649: certification runs per data store and Certification Model (see the pgsql twin).
 *
 * Only edfiTenantId cascades. odsId, teamId, createdById and catalogVersionId use NO ACTION:
 * SQL Server rejects a second cascade path (error 1785), and SET NULL counts as one.
 */
export class CertificationRuns1794000000000 implements MigrationInterface {
  name = 'CertificationRuns1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.dropTables(queryRunner, 'certification_process');

    await queryRunner.query(`
      CREATE TABLE [cert].[certification_run] (
        [certificationRunId] INT IDENTITY(1,1) NOT NULL,
        [edfiTenantId]       INT NOT NULL,
        [odsId]              INT NULL,
        [certificationModel] NVARCHAR(50) NOT NULL,
        [catalogVersionId]   INT NULL,
        [teamId]             INT NULL,
        [createdById]        INT NULL,
        [status]             NVARCHAR(50) NOT NULL,
        [createdAt]          datetime2 NOT NULL DEFAULT getdate(),
        [updatedAt]          datetime2 NOT NULL DEFAULT getdate(),
        CONSTRAINT [PK_cert_certification_run] PRIMARY KEY ([certificationRunId])
      )
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[certification_run]
        ADD CONSTRAINT [FK_cert_certification_run_edfiTenant]
        FOREIGN KEY ([edfiTenantId]) REFERENCES [edfi_tenant]([id]) ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[certification_run]
        ADD CONSTRAINT [FK_cert_certification_run_ods]
        FOREIGN KEY ([odsId]) REFERENCES [ods]([id]) ON DELETE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[certification_run]
        ADD CONSTRAINT [FK_cert_certification_run_catalogVersion]
        FOREIGN KEY ([catalogVersionId]) REFERENCES [cert].[catalog_version]([catalogVersionId])
        ON DELETE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[certification_run]
        ADD CONSTRAINT [FK_cert_certification_run_team]
        FOREIGN KEY ([teamId]) REFERENCES [team]([id]) ON DELETE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[certification_run]
        ADD CONSTRAINT [FK_cert_certification_run_createdBy]
        FOREIGN KEY ([createdById]) REFERENCES [user]([id]) ON DELETE NO ACTION
    `);
    // One open run per tenant, ODS and model. Open means not Approved or Rejected
    // (CERT_RUN_CLOSED_STATUSES). A filtered index can't use NOT IN, hence the two comparisons.
    await queryRunner.query(`
      CREATE UNIQUE INDEX [UQ_cert_certification_run_open_ods]
        ON [cert].[certification_run] ([edfiTenantId], [odsId], [certificationModel])
        WHERE [odsId] IS NOT NULL AND [status] <> 'approved' AND [status] <> 'rejected'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX [UQ_cert_certification_run_open_no_ods]
        ON [cert].[certification_run] ([edfiTenantId], [certificationModel])
        WHERE [odsId] IS NULL AND [status] <> 'approved' AND [status] <> 'rejected'
    `);

    await queryRunner.query(`
      CREATE TABLE [cert].[certification_run_scenario] (
        [certificationRunId] INT NOT NULL,
        [scenarioId]         INT NOT NULL,
        [status]             NVARCHAR(50) NOT NULL,
        [capturedVars]       NVARCHAR(max) NULL,
        [updatedAt]          datetime2 NOT NULL DEFAULT getdate(),
        CONSTRAINT [PK_cert_certification_run_scenario]
          PRIMARY KEY ([certificationRunId], [scenarioId])
      )
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[certification_run_scenario]
        ADD CONSTRAINT [FK_cert_run_scenario_run]
        FOREIGN KEY ([certificationRunId])
        REFERENCES [cert].[certification_run]([certificationRunId]) ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[certification_run_scenario]
        ADD CONSTRAINT [FK_cert_run_scenario_scenario]
        FOREIGN KEY ([scenarioId]) REFERENCES [cert].[scenario_catalog]([scenarioId])
        ON DELETE CASCADE
    `);

    await this.createStepTables(queryRunner, {
      parentColumn: 'certificationRunId',
      parentTable: 'certification_run',
      unique: 'UQ_cert_scenario_step_run_step',
      parentFk: 'FK_cert_scenario_step_run',
    });
  }

  /** Restores the shape left by CertificationStepResultDetails1793000000000. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropTables(queryRunner, 'certification_run');

    await queryRunner.query(`
      CREATE TABLE [cert].[certification_process] (
        [certificationProcessId] INT IDENTITY(1,1) NOT NULL,
        [edfiTenantId]           INT NOT NULL,
        [odsId]                  INT NULL,
        [catalogVersionId]       INT NOT NULL,
        [status]                 NVARCHAR(50) NOT NULL,
        [createdAt]              datetime2 NOT NULL DEFAULT getdate(),
        [updatedAt]              datetime2 NOT NULL DEFAULT getdate(),
        CONSTRAINT [PK_cert_certification_process] PRIMARY KEY ([certificationProcessId])
      )
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[certification_process]
        ADD CONSTRAINT [FK_cert_certification_process_edfiTenant]
        FOREIGN KEY ([edfiTenantId]) REFERENCES [edfi_tenant]([id]) ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[certification_process]
        ADD CONSTRAINT [FK_cert_certification_process_ods]
        FOREIGN KEY ([odsId]) REFERENCES [ods]([id]) ON DELETE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[certification_process]
        ADD CONSTRAINT [FK_cert_certification_process_catalogVersion]
        FOREIGN KEY ([catalogVersionId]) REFERENCES [cert].[catalog_version]([catalogVersionId])
        ON DELETE NO ACTION
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX [UQ_cert_certification_process_ods]
        ON [cert].[certification_process] ([edfiTenantId], [odsId], [catalogVersionId])
        WHERE [odsId] IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX [UQ_cert_certification_process_no_ods]
        ON [cert].[certification_process] ([edfiTenantId], [catalogVersionId])
        WHERE [odsId] IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE [cert].[certification_process_scenario] (
        [certificationProcessId] INT NOT NULL,
        [scenarioId]             INT NOT NULL,
        [status]                 NVARCHAR(50) NOT NULL,
        [capturedVars]           NVARCHAR(max) NULL,
        [updatedAt]              datetime2 NOT NULL DEFAULT getdate(),
        CONSTRAINT [PK_cert_certification_process_scenario]
          PRIMARY KEY ([certificationProcessId], [scenarioId])
      )
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[certification_process_scenario]
        ADD CONSTRAINT [FK_cert_process_scenario_process]
        FOREIGN KEY ([certificationProcessId])
        REFERENCES [cert].[certification_process]([certificationProcessId]) ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[certification_process_scenario]
        ADD CONSTRAINT [FK_cert_process_scenario_scenario]
        FOREIGN KEY ([scenarioId]) REFERENCES [cert].[scenario_catalog]([scenarioId])
        ON DELETE CASCADE
    `);

    await this.createStepTables(queryRunner, {
      parentColumn: 'certificationProcessId',
      parentTable: 'certification_process',
      unique: 'UQ_cert_scenario_step_process_step',
      parentFk: 'FK_cert_scenario_step_process',
    });
  }

  /** Drops the step tables, then the scenario and parent tables named after `parentTable`. */
  private async dropTables(queryRunner: QueryRunner, parentTable: string): Promise<void> {
    for (const table of [
      'scenario_step_error',
      'scenario_step',
      `${parentTable}_scenario`,
      parentTable,
    ]) {
      await queryRunner.query(
        `IF OBJECT_ID('[cert].[${table}]', 'U') IS NOT NULL DROP TABLE [cert].[${table}]`,
      );
    }
  }

  /** scenario_step and scenario_step_error differ between up and down only in their parent. */
  private async createStepTables(
    queryRunner: QueryRunner,
    names: { parentColumn: string; parentTable: string; unique: string; parentFk: string },
  ): Promise<void> {
    const { parentColumn, parentTable, unique, parentFk } = names;
    await queryRunner.query(`
      CREATE TABLE [cert].[scenario_step] (
        [stepRunId]        INT IDENTITY(1,1) NOT NULL,
        [${parentColumn}]  INT NOT NULL,
        [scenarioId]       INT NOT NULL,
        [stepId]           INT NOT NULL,
        [status]           NVARCHAR(50) NOT NULL,
        [inputs]           NVARCHAR(max) NULL,
        [runAt]            datetime2 NOT NULL,
        [responseStatus]   INT NULL,
        [responseSnapshot] NVARCHAR(max) NULL,
        CONSTRAINT [PK_cert_scenario_step] PRIMARY KEY ([stepRunId]),
        CONSTRAINT [${unique}] UNIQUE ([${parentColumn}], [stepId])
      )
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[scenario_step]
        ADD CONSTRAINT [${parentFk}]
        FOREIGN KEY ([${parentColumn}])
        REFERENCES [cert].[${parentTable}]([${parentColumn}]) ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[scenario_step]
        ADD CONSTRAINT [FK_cert_scenario_step_scenario]
        FOREIGN KEY ([scenarioId]) REFERENCES [cert].[scenario_catalog]([scenarioId])
        ON DELETE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[scenario_step]
        ADD CONSTRAINT [FK_cert_scenario_step_step]
        FOREIGN KEY ([stepId]) REFERENCES [cert].[step_catalog]([stepId]) ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE [cert].[scenario_step_error] (
        [errorId]   INT IDENTITY(1,1) NOT NULL,
        [stepRunId] INT NOT NULL,
        [kind]      NVARCHAR(50) NOT NULL,
        [field]     NVARCHAR(500) NULL,
        [expected]  NVARCHAR(max) NULL,
        [observed]  NVARCHAR(max) NULL,
        [message]   NVARCHAR(max) NULL,
        CONSTRAINT [PK_cert_scenario_step_error] PRIMARY KEY ([errorId])
      )
    `);
    await queryRunner.query(`
      ALTER TABLE [cert].[scenario_step_error]
        ADD CONSTRAINT [FK_cert_scenario_step_error_stepRun]
        FOREIGN KEY ([stepRunId]) REFERENCES [cert].[scenario_step]([stepRunId]) ON DELETE CASCADE
    `);
  }
}
