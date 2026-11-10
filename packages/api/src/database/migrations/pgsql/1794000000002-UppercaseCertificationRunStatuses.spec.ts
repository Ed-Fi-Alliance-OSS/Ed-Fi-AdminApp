import { UppercaseCertificationRunStatuses1794000000002 } from './1794000000002-UppercaseCertificationRunStatuses';
import {
  createMockQueryRunner,
  runMigrationSmokeTest,
} from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(UppercaseCertificationRunStatuses1794000000002);

describe('UppercaseCertificationRunStatuses1794000000002 (pgsql)', () => {
  it.each(['up', 'down'] as const)(
    '%s converts statuses without deleting runs and rebuilds both open-run indexes',
    async (direction) => {
      const runner = createMockQueryRunner();
      await new UppercaseCertificationRunStatuses1794000000002()[direction](runner);
      const statements = (runner.query as jest.Mock).mock.calls.map(([sql]) => String(sql));
      const upper = direction === 'up';
      expect(statements).toHaveLength(5);
      expect(statements[0]).toContain('DROP INDEX "cert"."UQ_cert_certification_run_open_ods"');
      expect(statements[1]).toContain('DROP INDEX "cert"."UQ_cert_certification_run_open_no_ods"');
      expect(statements[2]).toContain(
        `UPDATE "cert"."certification_run" SET "status" = ${upper ? 'UPPER' : 'LOWER'}("status")`,
      );
      expect(statements[3]).toContain(
        'ON "cert"."certification_run" ("edfiTenantId", "odsId", "certificationModel")',
      );
      expect(statements[3]).toContain('"odsId" IS NOT NULL');
      expect(statements[4]).toContain(
        'ON "cert"."certification_run" ("edfiTenantId", "certificationModel")',
      );
      expect(statements[4]).toContain('"odsId" IS NULL');
      for (const index of statements.slice(3)) {
        expect(index).toContain('CREATE UNIQUE INDEX');
        expect(index).toContain(
          upper
            ? `"status" NOT IN ('APPROVED', 'REJECTED')`
            : `"status" NOT IN ('approved', 'rejected')`,
        );
      }
      expect(statements.join('\n')).not.toMatch(/DROP TABLE|DELETE FROM/);
    },
  );
});
