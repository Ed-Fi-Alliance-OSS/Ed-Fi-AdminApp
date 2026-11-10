import 'reflect-metadata';
import { CertificationDomainCatalog1794000000001 } from './1794000000001-CertificationDomainCatalog';
import {
  createMockQueryRunner,
  runMigrationSmokeTest,
} from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(CertificationDomainCatalog1794000000001);

describe('CertificationDomainCatalog1794000000001 (pgsql) SQL', () => {
  const sqlOf = async (direction: 'up' | 'down') => {
    const queryRunner = createMockQueryRunner();
    await new CertificationDomainCatalog1794000000001()[direction](queryRunner);
    return (queryRunner.query as jest.Mock).mock.calls.map(([sql]) => String(sql));
  };

  it('renames the table, then its columns, constraints and sequence', async () => {
    expect(await sqlOf('up')).toEqual([
      'ALTER TABLE "cert"."area_catalog" RENAME TO "domain_catalog"',
      'ALTER TABLE "cert"."domain_catalog" RENAME COLUMN "areaId" TO "domainId"',
      'ALTER TABLE "cert"."scenario_catalog" RENAME COLUMN "areaId" TO "domainId"',
      'ALTER TABLE "cert"."domain_catalog" RENAME CONSTRAINT "PK_cert_area_catalog" TO "PK_cert_domain_catalog"',
      'ALTER TABLE "cert"."domain_catalog" RENAME CONSTRAINT "FK_cert_area_catalog_catalogVersion" TO "FK_cert_domain_catalog_catalogVersion"',
      'ALTER TABLE "cert"."scenario_catalog" RENAME CONSTRAINT "FK_cert_scenario_catalog_area" TO "FK_cert_scenario_catalog_domain"',
      'ALTER SEQUENCE "cert"."area_catalog_areaId_seq" RENAME TO "domain_catalog_domainId_seq"',
    ]);
  });

  it('down undoes every rename in reverse order, ending with the table', async () => {
    expect(await sqlOf('down')).toEqual([
      'ALTER SEQUENCE "cert"."domain_catalog_domainId_seq" RENAME TO "area_catalog_areaId_seq"',
      'ALTER TABLE "cert"."scenario_catalog" RENAME CONSTRAINT "FK_cert_scenario_catalog_domain" TO "FK_cert_scenario_catalog_area"',
      'ALTER TABLE "cert"."domain_catalog" RENAME CONSTRAINT "FK_cert_domain_catalog_catalogVersion" TO "FK_cert_area_catalog_catalogVersion"',
      'ALTER TABLE "cert"."domain_catalog" RENAME CONSTRAINT "PK_cert_domain_catalog" TO "PK_cert_area_catalog"',
      'ALTER TABLE "cert"."scenario_catalog" RENAME COLUMN "domainId" TO "areaId"',
      'ALTER TABLE "cert"."domain_catalog" RENAME COLUMN "domainId" TO "areaId"',
      'ALTER TABLE "cert"."domain_catalog" RENAME TO "area_catalog"',
    ]);
  });
});
