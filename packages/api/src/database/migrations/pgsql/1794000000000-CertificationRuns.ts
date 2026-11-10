import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AC-649: a certification run belongs to one data store and one Certification Model, and has
 * a workflow status.
 *
 * The process tables become run tables. They are dropped and recreated, which also clears the
 * demo certification results (the feature isn't in production). The catalog is not touched.
 */
export class CertificationRuns1794000000000 implements MigrationInterface {
  name = 'CertificationRuns1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.dropTables(queryRunner, 'certification_process');

    await queryRunner.query(`
      CREATE TABLE "cert"."certification_run" (
        "certificationRunId" SERIAL NOT NULL,
        "edfiTenantId"       integer NOT NULL,
        "odsId"              integer,
        "certificationModel" character varying(50) NOT NULL,
        "catalogVersionId"   integer,
        "teamId"             integer,
        "createdById"        integer,
        "status"             character varying(50) NOT NULL,
        "createdAt"          TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"          TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cert_certification_run" PRIMARY KEY ("certificationRunId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."certification_run"
        ADD CONSTRAINT "FK_cert_certification_run_edfiTenant"
        FOREIGN KEY ("edfiTenantId") REFERENCES "edfi_tenant"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."certification_run"
        ADD CONSTRAINT "FK_cert_certification_run_ods"
        FOREIGN KEY ("odsId") REFERENCES "ods"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."certification_run"
        ADD CONSTRAINT "FK_cert_certification_run_catalogVersion"
        FOREIGN KEY ("catalogVersionId") REFERENCES "cert"."catalog_version"("catalogVersionId")
        ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."certification_run"
        ADD CONSTRAINT "FK_cert_certification_run_team"
        FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."certification_run"
        ADD CONSTRAINT "FK_cert_certification_run_createdBy"
        FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL
    `);
    // One open run per tenant, ODS and model. Open means not Approved or Rejected
    // (CERT_RUN_CLOSED_STATUSES). Two indexes, because NULL never equals NULL in a unique index.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_cert_certification_run_open_ods"
        ON "cert"."certification_run" ("edfiTenantId", "odsId", "certificationModel")
        WHERE "odsId" IS NOT NULL AND "status" NOT IN ('approved', 'rejected')
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_cert_certification_run_open_no_ods"
        ON "cert"."certification_run" ("edfiTenantId", "certificationModel")
        WHERE "odsId" IS NULL AND "status" NOT IN ('approved', 'rejected')
    `);

    await queryRunner.query(`
      CREATE TABLE "cert"."certification_run_scenario" (
        "certificationRunId" integer NOT NULL,
        "scenarioId"         integer NOT NULL,
        "status"             character varying(50) NOT NULL,
        "capturedVars"       jsonb,
        "updatedAt"          TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cert_certification_run_scenario"
          PRIMARY KEY ("certificationRunId", "scenarioId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."certification_run_scenario"
        ADD CONSTRAINT "FK_cert_run_scenario_run"
        FOREIGN KEY ("certificationRunId")
        REFERENCES "cert"."certification_run"("certificationRunId") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."certification_run_scenario"
        ADD CONSTRAINT "FK_cert_run_scenario_scenario"
        FOREIGN KEY ("scenarioId") REFERENCES "cert"."scenario_catalog"("scenarioId")
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
      CREATE TABLE "cert"."certification_process" (
        "certificationProcessId" SERIAL NOT NULL,
        "edfiTenantId"           integer NOT NULL,
        "odsId"                  integer,
        "catalogVersionId"       integer NOT NULL,
        "status"                 character varying(50) NOT NULL,
        "createdAt"              TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"              TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cert_certification_process" PRIMARY KEY ("certificationProcessId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."certification_process"
        ADD CONSTRAINT "FK_cert_certification_process_edfiTenant"
        FOREIGN KEY ("edfiTenantId") REFERENCES "edfi_tenant"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."certification_process"
        ADD CONSTRAINT "FK_cert_certification_process_ods"
        FOREIGN KEY ("odsId") REFERENCES "ods"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."certification_process"
        ADD CONSTRAINT "FK_cert_certification_process_catalogVersion"
        FOREIGN KEY ("catalogVersionId") REFERENCES "cert"."catalog_version"("catalogVersionId")
        ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_cert_certification_process_ods"
        ON "cert"."certification_process" ("edfiTenantId", "odsId", "catalogVersionId")
        WHERE "odsId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_cert_certification_process_no_ods"
        ON "cert"."certification_process" ("edfiTenantId", "catalogVersionId")
        WHERE "odsId" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "cert"."certification_process_scenario" (
        "certificationProcessId" integer NOT NULL,
        "scenarioId"             integer NOT NULL,
        "status"                 character varying(50) NOT NULL,
        "capturedVars"           jsonb,
        "updatedAt"              TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cert_certification_process_scenario"
          PRIMARY KEY ("certificationProcessId", "scenarioId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."certification_process_scenario"
        ADD CONSTRAINT "FK_cert_process_scenario_process"
        FOREIGN KEY ("certificationProcessId")
        REFERENCES "cert"."certification_process"("certificationProcessId") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."certification_process_scenario"
        ADD CONSTRAINT "FK_cert_process_scenario_scenario"
        FOREIGN KEY ("scenarioId") REFERENCES "cert"."scenario_catalog"("scenarioId")
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
    await queryRunner.query(`DROP TABLE IF EXISTS "cert"."scenario_step_error"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cert"."scenario_step"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cert"."${parentTable}_scenario"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cert"."${parentTable}"`);
  }

  /** scenario_step and scenario_step_error differ between up and down only in their parent. */
  private async createStepTables(
    queryRunner: QueryRunner,
    names: { parentColumn: string; parentTable: string; unique: string; parentFk: string },
  ): Promise<void> {
    const { parentColumn, parentTable, unique, parentFk } = names;
    await queryRunner.query(`
      CREATE TABLE "cert"."scenario_step" (
        "stepRunId"        SERIAL NOT NULL,
        "${parentColumn}"  integer NOT NULL,
        "scenarioId"       integer NOT NULL,
        "stepId"           integer NOT NULL,
        "status"           character varying(50) NOT NULL,
        "inputs"           jsonb,
        "runAt"            TIMESTAMP NOT NULL,
        "responseStatus"   integer NULL,
        "responseSnapshot" text NULL,
        CONSTRAINT "PK_cert_scenario_step" PRIMARY KEY ("stepRunId"),
        CONSTRAINT "${unique}" UNIQUE ("${parentColumn}", "stepId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."scenario_step"
        ADD CONSTRAINT "${parentFk}"
        FOREIGN KEY ("${parentColumn}")
        REFERENCES "cert"."${parentTable}"("${parentColumn}") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."scenario_step"
        ADD CONSTRAINT "FK_cert_scenario_step_scenario"
        FOREIGN KEY ("scenarioId") REFERENCES "cert"."scenario_catalog"("scenarioId")
        ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."scenario_step"
        ADD CONSTRAINT "FK_cert_scenario_step_step"
        FOREIGN KEY ("stepId") REFERENCES "cert"."step_catalog"("stepId") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      CREATE TABLE "cert"."scenario_step_error" (
        "errorId"   SERIAL NOT NULL,
        "stepRunId" integer NOT NULL,
        "kind"      character varying(50) NOT NULL,
        "field"     character varying(500) NULL,
        "expected"  text NULL,
        "observed"  text NULL,
        "message"   text NULL,
        CONSTRAINT "PK_cert_scenario_step_error" PRIMARY KEY ("errorId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "cert"."scenario_step_error"
        ADD CONSTRAINT "FK_cert_scenario_step_error_stepRun"
        FOREIGN KEY ("stepRunId") REFERENCES "cert"."scenario_step"("stepRunId") ON DELETE CASCADE
    `);
  }
}
