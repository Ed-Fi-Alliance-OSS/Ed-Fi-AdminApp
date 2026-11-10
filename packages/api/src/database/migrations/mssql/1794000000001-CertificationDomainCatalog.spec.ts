import 'reflect-metadata';
import { CertificationDomainCatalog1794000000001 } from './1794000000001-CertificationDomainCatalog';
import {
  createMockQueryRunner,
  runMigrationSmokeTest,
} from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(CertificationDomainCatalog1794000000001);

describe('CertificationDomainCatalog1794000000001 (mssql) SQL', () => {
  const sqlOf = async (direction: 'up' | 'down') => {
    const queryRunner = createMockQueryRunner();
    await new CertificationDomainCatalog1794000000001()[direction](queryRunner);
    return (queryRunner.query as jest.Mock).mock.calls.map(([sql]) => String(sql));
  };

  it('renames the table, then its columns and constraints, with bare new names', async () => {
    expect(await sqlOf('up')).toEqual([
      `EXEC sp_rename 'cert.area_catalog', 'domain_catalog'`,
      `EXEC sp_rename 'cert.domain_catalog.areaId', 'domainId', 'COLUMN'`,
      `EXEC sp_rename 'cert.scenario_catalog.areaId', 'domainId', 'COLUMN'`,
      `EXEC sp_rename 'cert.PK_cert_area_catalog', 'PK_cert_domain_catalog'`,
      `EXEC sp_rename 'cert.FK_cert_area_catalog_catalogVersion', 'FK_cert_domain_catalog_catalogVersion'`,
      `EXEC sp_rename 'cert.FK_cert_scenario_catalog_area', 'FK_cert_scenario_catalog_domain'`,
    ]);
  });

  it('down undoes every rename in reverse order, ending with the table', async () => {
    expect(await sqlOf('down')).toEqual([
      `EXEC sp_rename 'cert.FK_cert_scenario_catalog_domain', 'FK_cert_scenario_catalog_area'`,
      `EXEC sp_rename 'cert.FK_cert_domain_catalog_catalogVersion', 'FK_cert_area_catalog_catalogVersion'`,
      `EXEC sp_rename 'cert.PK_cert_domain_catalog', 'PK_cert_area_catalog'`,
      `EXEC sp_rename 'cert.scenario_catalog.domainId', 'areaId', 'COLUMN'`,
      `EXEC sp_rename 'cert.domain_catalog.domainId', 'areaId', 'COLUMN'`,
      `EXEC sp_rename 'cert.domain_catalog', 'area_catalog'`,
    ]);
  });
});
