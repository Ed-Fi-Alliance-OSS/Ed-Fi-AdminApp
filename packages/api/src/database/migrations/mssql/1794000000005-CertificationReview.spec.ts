import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { CertificationReview1794000000005 } from './1794000000005-CertificationReview';
import { runMigrationSmokeTest } from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(CertificationReview1794000000005);

const run = async (direction: 'up' | 'down') => {
  const query = jest.fn().mockResolvedValue(undefined);
  await new CertificationReview1794000000005()[direction]({
    query,
  } as unknown as QueryRunner);
  return query.mock.calls.map(([sql]) => sql as string);
};

describe('CertificationReview1794000000005 (mssql)', () => {
  it('up adds submittedAt, backfills the three review statuses and creates the comment table', async () => {
    const sql = await run('up');
    expect(sql.find((s) => s.includes('ADD [submittedAt] datetime2 NULL'))).toBeDefined();

    const backfill = sql.find((s) => s.includes('SET [submittedAt] = [statusChangedAt]'));
    expect(backfill).toContain(
      `[status] IN ('READY_FOR_REVIEW', 'READY_FOR_REVIEW_WITH_CHANGES', 'IN_REVIEW')`,
    );

    const create = sql.find(
      (s) => s.includes('[cert].[certification_run_comment]') && s.includes('CREATE TABLE'),
    );
    expect(create).toContain('FK_cert_certification_run_comment_run');
    expect(create).toContain('ON DELETE CASCADE');
    expect(create).toContain('FK_cert_certification_run_comment_author');
    expect(create).not.toContain('SET NULL');

    expect(sql.find((s) => s.includes('IDX_cert_certification_run_comment_run'))).toBeDefined();
  });

  it('down drops the index and the table before the column', async () => {
    const sql = await run('down');
    const index = sql.findIndex((s) => s.includes('DROP INDEX'));
    const table = sql.findIndex((s) => s.includes('DROP TABLE [cert].[certification_run_comment]'));
    const column = sql.findIndex((s) => s.includes('DROP COLUMN [submittedAt]'));
    expect(index).toBeGreaterThanOrEqual(0);
    expect(table).toBeGreaterThan(index);
    expect(column).toBeGreaterThan(table);
  });
});
