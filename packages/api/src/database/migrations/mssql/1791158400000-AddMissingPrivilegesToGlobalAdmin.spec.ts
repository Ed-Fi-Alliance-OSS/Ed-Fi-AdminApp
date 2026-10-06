import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { AddMissingPrivilegesToGlobalAdmin1791158400000 } from './1791158400000-AddMissingPrivilegesToGlobalAdmin';
import { AC644_ALL_PRIVILEGE_CODES } from '../shared/ac644-privilege-snapshot';
import { runMigrationSmokeTest } from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(AddMissingPrivilegesToGlobalAdmin1791158400000);

/** QueryRunner whose SELECT returns `selectRows`; UPDATE calls are recorded. */
const queryRunnerReturning = (selectRows: { privilegeIds: string | null }[]) => {
  const query = jest.fn(async (sql: string) => (sql.startsWith('SELECT') ? selectRows : undefined));
  return { query, queryRunner: { query } as unknown as QueryRunner };
};
const updateCalls = (query: jest.Mock) =>
  query.mock.calls.filter(([sql]) => (sql as string).startsWith('UPDATE'));

describe('AddMissingPrivilegesToGlobalAdmin1791158400000 (mssql) up()', () => {
  const migration = new AddMissingPrivilegesToGlobalAdmin1791158400000();

  it('only selects role 2 when it is a UserGlobal role', async () => {
    const { query, queryRunner } = queryRunnerReturning([]);
    await migration.up(queryRunner);
    expect(query).toHaveBeenCalledWith(
      `SELECT [privilegeIds] FROM [role] WHERE [id] = @0 AND [type] = @1`,
      [2, '"UserGlobal"']
    );
  });

  it('does nothing when role 2 is missing or not a UserGlobal role', async () => {
    const { query, queryRunner } = queryRunnerReturning([]);
    await migration.up(queryRunner);
    expect(updateCalls(query)).toHaveLength(0);
  });

  it('parses the comma-separated list and appends only the missing codes', async () => {
    const current = ['me:read', 'team.role:read', 'legacy:code'];
    const { query, queryRunner } = queryRunnerReturning([{ privilegeIds: current.join(',') }]);

    await migration.up(queryRunner);

    const [[sql, [written, id]]] = updateCalls(query);
    expect(sql).toBe(`UPDATE [role] SET [privilegeIds] = @0 WHERE [id] = @1`);
    expect(id).toBe(2);
    expect(typeof written).toBe('string');
    const codes = (written as string).split(',');
    expect(codes.slice(0, current.length)).toEqual(current);
    expect(new Set(codes)).toEqual(new Set([...current, ...AC644_ALL_PRIVILEGE_CODES]));
    expect(codes).toHaveLength(new Set(codes).size);
    expect(codes).not.toContain('');
  });

  it('does not treat a code as present just because another code contains it', async () => {
    // `team.role:read` contains `role:read` as a substring; a NOT LIKE check would miss it.
    const { query, queryRunner } = queryRunnerReturning([{ privilegeIds: 'team.role:read' }]);
    await migration.up(queryRunner);
    const [[, [written]]] = updateCalls(query);
    expect((written as string).split(',')).toContain('role:read');
  });

  it.each([
    ['an empty string', ''],
    ['null', null],
  ])('treats %s as no privileges', async (_, value) => {
    const { query, queryRunner } = queryRunnerReturning([{ privilegeIds: value }]);
    await migration.up(queryRunner);
    const [[, [written]]] = updateCalls(query);
    expect(written).toBe(AC644_ALL_PRIVILEGE_CODES.join(','));
  });

  it('is idempotent: a second run against the backfilled row writes nothing', async () => {
    const first = queryRunnerReturning([{ privilegeIds: 'me:read' }]);
    await migration.up(first.queryRunner);
    const [[, [written]]] = updateCalls(first.query);

    const second = queryRunnerReturning([{ privilegeIds: written as string }]);
    await migration.up(second.queryRunner);
    expect(updateCalls(second.query)).toHaveLength(0);
  });
});
