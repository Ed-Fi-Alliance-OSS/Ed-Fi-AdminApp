import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { AddCertificationVendorRole1793100000000 } from './1793100000000-AddCertificationVendorRole';
import {
  AC652_CERTIFICATION_PRIVILEGE_CODES as CODES,
  CERTIFICATION_VENDOR_PRIVILEGE_CODES,
  CERTIFICATION_VENDOR_ROLE_NAME,
} from '../shared/ac652-certification-vendor';
import { runMigrationSmokeTest } from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(AddCertificationVendorRole1793100000000);

type Call = { sql: string; params: unknown[] };

const record = async (direction: 'up' | 'down'): Promise<Call[]> => {
  const query = jest.fn().mockResolvedValue(undefined);
  await new AddCertificationVendorRole1793100000000()[direction]({
    query,
  } as unknown as QueryRunner);
  return query.mock.calls.map(([sql, params]) => ({ sql: sql as string, params: params ?? [] }));
};
const updates = (calls: Call[]) => calls.filter((c) => c.sql.startsWith('UPDATE [role]'));
const forRole = (calls: Call[], id: number, code: string) =>
  calls.filter((c) => c.params.includes(id) && c.params.includes(code));

describe('AddCertificationVendorRole1793100000000 (mssql)', () => {
  it('has the expected name', () => {
    expect(new AddCertificationVendorRole1793100000000().name).toBe(
      'AddCertificationVendorRole1793100000000',
    );
  });

  describe('up()', () => {
    it('grants both codes to Global admin only when it is UserGlobal', async () => {
      const calls = await record('up');
      for (const code of CODES) {
        const matches = forRole(calls, 2, code);
        expect(matches).toHaveLength(1);
        expect(matches[0].sql).toContain('[type] = ');
        expect(matches[0].params).toContain('"UserGlobal"');
      }
    });

    it('grants both codes to roles 4 and 5', async () => {
      const calls = await record('up');
      for (const id of [4, 5]) {
        for (const code of CODES) {
          expect(forRole(calls, id, code)).toHaveLength(1);
        }
      }
    });

    it('never touches role 6', async () => {
      const calls = await record('up');
      for (const { sql, params } of calls) {
        expect(params).not.toContain(6);
        expect(sql).not.toMatch(/\b6\b/);
      }
    });

    it('inserts the role without an id and only if missing', async () => {
      const calls = await record('up');
      const insert = calls.find((c) => c.sql.startsWith('INSERT INTO [role]'));
      expect(insert).toBeDefined();
      expect(insert.sql.split('SELECT')[0]).not.toContain('[id]');
      expect(insert.sql).toContain('NOT EXISTS');
      expect(insert.sql).toContain('[teamId] IS NULL');
      expect(insert.params).toContain(CERTIFICATION_VENDOR_ROLE_NAME);
      expect(insert.params).toContain('"UserTeam"');
      expect(insert.params).toContain(CERTIFICATION_VENDOR_PRIVILEGE_CODES.join(','));
      expect(CERTIFICATION_VENDOR_PRIVILEGE_CODES).toHaveLength(5);
    });

    it('guards every append so re-running is a no-op', async () => {
      const calls = updates(await record('up'));
      expect(calls).toHaveLength(6);
      for (const { sql } of calls) {
        expect(sql).toContain(`NOT LIKE '%,' + @0 + ',%'`);
      }
    });

    it('handles empty or NULL privilegeIds', async () => {
      const calls = updates(await record('up'));
      for (const { sql } of calls) {
        expect(sql).toContain(`ISNULL([privilegeIds], '')`);
        expect(sql).toMatch(/LEN\(ISNULL\(\[privilegeIds\], ''\)\) > 0/);
      }
    });
  });

  describe('down()', () => {
    it('clears memberships, deletes the role, and removes both codes from 2, 4, 5', async () => {
      const calls = await record('down');
      const sqls = calls.map((c) => c.sql);

      const clearIdx = sqls.findIndex((s) => s.startsWith('UPDATE [user_team_membership]'));
      const deleteIdx = sqls.findIndex((s) => s.startsWith('DELETE FROM [role]'));
      expect(clearIdx).toBeGreaterThanOrEqual(0);
      expect(sqls[clearIdx]).toContain('[roleId] = NULL');
      expect(deleteIdx).toBeGreaterThan(clearIdx);
      expect(sqls[deleteIdx]).toContain('[teamId] IS NULL');
      expect(calls[deleteIdx].params).toEqual([CERTIFICATION_VENDOR_ROLE_NAME, '"UserTeam"']);

      for (const id of [2, 4, 5]) {
        for (const code of CODES) {
          const matches = forRole(calls, id, code);
          expect(matches).toHaveLength(1);
          expect(matches[0].sql).toContain('REPLACE');
        }
      }
      for (const { params } of calls) {
        expect(params).not.toContain(6);
      }
    });
  });
});
