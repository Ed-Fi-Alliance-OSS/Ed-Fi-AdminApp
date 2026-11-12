import 'reflect-metadata';
import { CertificationRuns1794000000000 } from './1794000000000-CertificationRuns';
import {
  createMockQueryRunner,
  runMigrationSmokeTest,
} from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(CertificationRuns1794000000000);

describe('CertificationRuns1794000000000 (mssql) SQL', () => {
  const sqlOf = async (direction: 'up' | 'down') => {
    const queryRunner = createMockQueryRunner();
    await new CertificationRuns1794000000000()[direction](queryRunner);
    return (queryRunner.query as jest.Mock).mock.calls.map(([sql]) => String(sql));
  };
  const statement = (sql: string[], fragment: string) => sql.find((s) => s.includes(fragment)) ?? '';

  it('drops the process tables before creating the run tables', async () => {
    const sql = await sqlOf('up');
    const drop = sql.findIndex((s) => s.includes('DROP TABLE [cert].[certification_process]'));
    const create = sql.findIndex((s) => s.includes('CREATE TABLE [cert].[certification_run] ('));
    expect(drop).toBeGreaterThanOrEqual(0);
    expect(create).toBeGreaterThan(drop);
  });

  it('gives the run its model, team and creator, and an optional catalog version', async () => {
    const table = statement(await sqlOf('up'), 'CREATE TABLE [cert].[certification_run] (');
    expect(table).toMatch(/\[certificationModel\]\s+NVARCHAR\(50\) NOT NULL/);
    expect(table).toMatch(/\[teamId\]\s+INT NULL/);
    expect(table).toMatch(/\[createdById\]\s+INT NULL/);
    expect(table).toMatch(/\[catalogVersionId\]\s+INT NULL/);
  });

  it('allows one open run per tenant, ODS and model, without NOT IN', async () => {
    const index = statement(await sqlOf('up'), '[UQ_cert_certification_run_open_ods]');
    expect(index).toContain('([edfiTenantId], [odsId], [certificationModel])');
    expect(index).toContain(
      `[odsId] IS NOT NULL AND [status] <> 'approved' AND [status] <> 'rejected'`,
    );
    expect(index).not.toContain('NOT IN');
  });

  it('allows one open run per tenant and model when there is no ODS', async () => {
    const index = statement(await sqlOf('up'), '[UQ_cert_certification_run_open_no_ods]');
    expect(index).toContain('([edfiTenantId], [certificationModel])');
    expect(index).toContain(`[odsId] IS NULL AND [status] <> 'approved' AND [status] <> 'rejected'`);
  });

  it.each(['_ods]', '_team]', '_createdBy]', '_catalogVersion]'])(
    'uses NO ACTION for the run foreign key %s',
    async (suffix) => {
      const fk = statement(await sqlOf('up'), `[FK_cert_certification_run${suffix}`);
      expect(fk).toContain('ON DELETE NO ACTION');
    },
  );

  it('keys step results and scenario rows by the run, keeping the response columns', async () => {
    const sql = await sqlOf('up');
    const step = statement(sql, 'CREATE TABLE [cert].[scenario_step] (');
    expect(step).toContain('[certificationRunId]');
    expect(step).toContain('[responseStatus]');
    expect(step).toContain('[responseSnapshot]');
    expect(step).toContain('[UQ_cert_scenario_step_run_step] UNIQUE ([certificationRunId], [stepId])');
    expect(statement(sql, 'CREATE TABLE [cert].[certification_run_scenario] (')).toContain(
      'PRIMARY KEY ([certificationRunId], [scenarioId])',
    );
    expect(statement(sql, 'CREATE TABLE [cert].[scenario_step_error] (')).toMatch(
      /\[kind\]\s+NVARCHAR\(50\) NOT NULL/,
    );
  });

  it('down restores the process tables and their indexes', async () => {
    const sql = await sqlOf('down');
    const joined = sql.join('\n');
    expect(joined).toContain('DROP TABLE [cert].[certification_run]');
    expect(joined).toContain('CREATE TABLE [cert].[certification_process] (');
    expect(joined).toContain('[UQ_cert_certification_process_ods]');
    expect(joined).toContain('[UQ_cert_certification_process_no_ods]');
    const step = statement(sql, 'CREATE TABLE [cert].[scenario_step] (');
    expect(step).toContain('[certificationProcessId]');
    expect(step).toContain('[responseSnapshot]');
  });
});
