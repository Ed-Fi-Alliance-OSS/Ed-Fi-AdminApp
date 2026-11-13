import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { AddCertificationRunStatusChangedAt1794000000003 } from './1794000000003-AddCertificationRunStatusChangedAt';
import { runMigrationSmokeTest } from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(AddCertificationRunStatusChangedAt1794000000003);

const run = async (direction: 'up' | 'down') => {
  const query = jest.fn().mockResolvedValue(undefined);
  await new AddCertificationRunStatusChangedAt1794000000003()[direction]({
    query,
  } as unknown as QueryRunner);
  return query.mock.calls.map(([sql]) => sql as string);
};

describe('AddCertificationRunStatusChangedAt1794000000003 (mssql)', () => {
  it('up adds the column, backfills it from updatedAt and indexes (status, statusChangedAt)', async () => {
    const sql = await run('up');
    expect(sql).toHaveLength(3);
    expect(sql[0]).toContain('ADD [statusChangedAt]');
    expect(sql[0]).toContain('DF_cert_certification_run_statusChangedAt');
    expect(sql[1]).toContain('SET [statusChangedAt] = [updatedAt]');
    expect(sql[2]).toContain('IDX_cert_certification_run_status_changed');
    expect(sql[2]).toContain('([status], [statusChangedAt])');
  });

  it('down drops the index then the column', async () => {
    const sql = await run('down');
    expect(sql).toHaveLength(3);
    expect(sql[0]).toContain('DROP INDEX');
    expect(sql[0]).toContain('IDX_cert_certification_run_status_changed');
    expect(sql[1]).toContain('DROP CONSTRAINT [DF_cert_certification_run_statusChangedAt]');
    expect(sql[2]).toContain('DROP COLUMN [statusChangedAt]');
  });
});
