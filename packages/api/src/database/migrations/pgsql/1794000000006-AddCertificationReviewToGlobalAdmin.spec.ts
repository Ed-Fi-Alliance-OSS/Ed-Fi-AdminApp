import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { AddCertificationReviewToGlobalAdmin1794000000006 } from './1794000000006-AddCertificationReviewToGlobalAdmin';
import { runMigrationSmokeTest } from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(AddCertificationReviewToGlobalAdmin1794000000006);

/** QueryRunner whose SELECT returns `selectRows`; UPDATE calls are recorded. */
const queryRunnerReturning = (selectRows: { privilegeIds: string[] | null }[]) => {
  const query = jest.fn(async (sql: string) => (sql.startsWith('SELECT') ? selectRows : undefined));
  return { query, queryRunner: { query } as unknown as QueryRunner };
};
const updateCalls = (query: jest.Mock) =>
  query.mock.calls.filter(([sql]) => (sql as string).startsWith('UPDATE'));

describe('AddCertificationReviewToGlobalAdmin1794000000006 (pgsql)', () => {
  const migration = new AddCertificationReviewToGlobalAdmin1794000000006();

  describe('up()', () => {
    it('only selects role 2 when it is a UserGlobal role', async () => {
      const { query, queryRunner } = queryRunnerReturning([]);
      await migration.up(queryRunner);
      expect(query).toHaveBeenCalledWith(
        `SELECT "privilegeIds" FROM "role" WHERE "id" = $1 AND "type" = $2`,
        [2, '"UserGlobal"'],
      );
    });

    it('does nothing when role 2 is missing or not a UserGlobal role', async () => {
      const { query, queryRunner } = queryRunnerReturning([]);
      await migration.up(queryRunner);
      expect(updateCalls(query)).toHaveLength(0);
    });

    it('appends certification:review and keeps existing codes', async () => {
      const current = ['me:read', 'role:read', 'legacy:code'];
      const { query, queryRunner } = queryRunnerReturning([{ privilegeIds: current }]);
      await migration.up(queryRunner);
      const [[sql, [written, id]]] = updateCalls(query);
      expect(sql).toBe(`UPDATE "role" SET "privilegeIds" = $1 WHERE "id" = $2`);
      expect(id).toBe(2);
      expect(written).toEqual([...current, 'certification:review']);
    });

    it('treats null privilegeIds as empty', async () => {
      const { query, queryRunner } = queryRunnerReturning([{ privilegeIds: null }]);
      await migration.up(queryRunner);
      const [[, [written]]] = updateCalls(query);
      expect(written).toEqual(['certification:review']);
    });

    it('is idempotent when the code is already present', async () => {
      const { query, queryRunner } = queryRunnerReturning([
        { privilegeIds: ['me:read', 'certification:review'] },
      ]);
      await migration.up(queryRunner);
      expect(updateCalls(query)).toHaveLength(0);
    });
  });

  describe('down()', () => {
    it('down removes only certification:review', async () => {
      const { query, queryRunner } = queryRunnerReturning([
        { privilegeIds: ['me:read', 'certification:read', 'certification:review', 'role:read'] },
      ]);
      await migration.down(queryRunner);
      const [[sql, [written, id]]] = updateCalls(query);
      expect(sql).toBe(`UPDATE "role" SET "privilegeIds" = $1 WHERE "id" = $2`);
      expect(id).toBe(2);
      expect(written).toEqual(['me:read', 'certification:read', 'role:read']);
    });

    it('down does nothing when role 2 is missing or the code is absent', async () => {
      const missing = queryRunnerReturning([]);
      await migration.down(missing.queryRunner);
      expect(updateCalls(missing.query)).toHaveLength(0);

      const absent = queryRunnerReturning([{ privilegeIds: ['me:read'] }]);
      await migration.down(absent.queryRunner);
      expect(updateCalls(absent.query)).toHaveLength(0);
    });
  });
});
