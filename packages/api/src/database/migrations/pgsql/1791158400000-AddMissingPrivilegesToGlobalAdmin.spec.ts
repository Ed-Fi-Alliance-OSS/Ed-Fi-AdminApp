import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { AddMissingPrivilegesToGlobalAdmin1791158400000 } from './1791158400000-AddMissingPrivilegesToGlobalAdmin';
import { AC644_ALL_PRIVILEGE_CODES } from '../shared/ac644-privilege-snapshot';
import { runMigrationSmokeTest } from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(AddMissingPrivilegesToGlobalAdmin1791158400000);

/** QueryRunner whose SELECT returns `selectRows`; UPDATE calls are recorded. */
const queryRunnerReturning = (selectRows: { privilegeIds: string[] | null }[]) => {
  const query = jest.fn(async (sql: string) => (sql.startsWith('SELECT') ? selectRows : undefined));
  return { query, queryRunner: { query } as unknown as QueryRunner };
};
const updateCalls = (query: jest.Mock) =>
  query.mock.calls.filter(([sql]) => (sql as string).startsWith('UPDATE'));

describe('AddMissingPrivilegesToGlobalAdmin1791158400000 (pgsql) up()', () => {
  const migration = new AddMissingPrivilegesToGlobalAdmin1791158400000();

  it('only selects role 2 when it is a UserGlobal role', async () => {
    const { query, queryRunner } = queryRunnerReturning([]);
    await migration.up(queryRunner);
    expect(query).toHaveBeenCalledWith(
      `SELECT "privilegeIds" FROM "role" WHERE "id" = $1 AND "type" = $2`,
      [2, '"UserGlobal"']
    );
  });

  it('does nothing when role 2 is missing or not a UserGlobal role', async () => {
    const { query, queryRunner } = queryRunnerReturning([]);
    await migration.up(queryRunner);
    expect(updateCalls(query)).toHaveLength(0);
  });

  it('appends only the missing codes and keeps existing ones (including unknown legacy codes)', async () => {
    const current = ['me:read', 'role:read', 'legacy:code'];
    const { query, queryRunner } = queryRunnerReturning([{ privilegeIds: current }]);

    await migration.up(queryRunner);

    const [[sql, [written, id]]] = updateCalls(query);
    expect(sql).toBe(`UPDATE "role" SET "privilegeIds" = $1 WHERE "id" = $2`);
    expect(id).toBe(2);
    expect(written.slice(0, current.length)).toEqual(current);
    expect(new Set(written)).toEqual(new Set([...current, ...AC644_ALL_PRIVILEGE_CODES]));
    expect(written).toHaveLength(new Set(written).size);
  });

  it('treats null privilegeIds as empty', async () => {
    const { query, queryRunner } = queryRunnerReturning([{ privilegeIds: null }]);
    await migration.up(queryRunner);
    const [[, [written]]] = updateCalls(query);
    expect(written).toEqual([...AC644_ALL_PRIVILEGE_CODES]);
  });

  it('is idempotent: a second run against the backfilled row writes nothing', async () => {
    const first = queryRunnerReturning([{ privilegeIds: ['me:read'] }]);
    await migration.up(first.queryRunner);
    const [[, [written]]] = updateCalls(first.query);

    const second = queryRunnerReturning([{ privilegeIds: written }]);
    await migration.up(second.queryRunner);
    expect(updateCalls(second.query)).toHaveLength(0);
  });
});
