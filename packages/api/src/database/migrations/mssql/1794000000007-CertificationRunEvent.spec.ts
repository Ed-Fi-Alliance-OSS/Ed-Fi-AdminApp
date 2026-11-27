import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { CertificationRunEvent1794000000007 } from './1794000000007-CertificationRunEvent';
import { runMigrationSmokeTest } from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(CertificationRunEvent1794000000007);

const run = async (direction: 'up' | 'down') => {
  const query = jest.fn().mockResolvedValue(undefined);
  await new CertificationRunEvent1794000000007()[direction]({
    query,
  } as unknown as QueryRunner);
  return query.mock.calls.map(([sql]) => sql as string);
};

describe('CertificationRunEvent1794000000007 (mssql)', () => {
  it('up creates the event table with a cascading run FK and an index', async () => {
    const sql = await run('up');

    const create = sql.find(
      (s) => s.includes('[cert].[certification_run_event]') && s.includes('CREATE TABLE'),
    );
    expect(create).toContain('FK_cert_certification_run_event_run');
    expect(create).toContain('ON DELETE CASCADE');
    expect(create).not.toContain('FK_cert_certification_run_event_comment');
    expect(create).not.toMatch(/REFERENCES \[cert\]\.\[certification_run_comment\]/);
    expect(create).not.toContain('REFERENCES [user]');

    expect(
      sql.find(
        (s) => s.includes('CREATE INDEX') && s.includes('IDX_cert_certification_run_event_run'),
      ),
    ).toBeDefined();
  });

  it('down drops the index before the table', async () => {
    const sql = await run('down');
    const index = sql.findIndex((s) => s.includes('DROP INDEX'));
    const table = sql.findIndex((s) => s.includes('DROP TABLE [cert].[certification_run_event]'));
    expect(index).toBeGreaterThanOrEqual(0);
    expect(table).toBeGreaterThan(index);
  });
});
