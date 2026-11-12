import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AC-649: cert.area_catalog becomes cert.domain_catalog and areaId becomes domainId (see the
 * pgsql twin). sp_rename takes the schema-qualified old name and a bare new name: a qualified
 * new name would become part of the object's name.
 */
export class CertificationDomainCatalog1794000000001 implements MigrationInterface {
  name = 'CertificationDomainCatalog1794000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`EXEC sp_rename 'cert.area_catalog', 'domain_catalog'`);
    await queryRunner.query(`EXEC sp_rename 'cert.domain_catalog.areaId', 'domainId', 'COLUMN'`);
    await queryRunner.query(`EXEC sp_rename 'cert.scenario_catalog.areaId', 'domainId', 'COLUMN'`);
    await queryRunner.query(
      `EXEC sp_rename 'cert.PK_cert_area_catalog', 'PK_cert_domain_catalog'`,
    );
    await queryRunner.query(
      `EXEC sp_rename 'cert.FK_cert_area_catalog_catalogVersion', 'FK_cert_domain_catalog_catalogVersion'`,
    );
    await queryRunner.query(
      `EXEC sp_rename 'cert.FK_cert_scenario_catalog_area', 'FK_cert_scenario_catalog_domain'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `EXEC sp_rename 'cert.FK_cert_scenario_catalog_domain', 'FK_cert_scenario_catalog_area'`,
    );
    await queryRunner.query(
      `EXEC sp_rename 'cert.FK_cert_domain_catalog_catalogVersion', 'FK_cert_area_catalog_catalogVersion'`,
    );
    await queryRunner.query(
      `EXEC sp_rename 'cert.PK_cert_domain_catalog', 'PK_cert_area_catalog'`,
    );
    await queryRunner.query(`EXEC sp_rename 'cert.scenario_catalog.domainId', 'areaId', 'COLUMN'`);
    await queryRunner.query(`EXEC sp_rename 'cert.domain_catalog.domainId', 'areaId', 'COLUMN'`);
    await queryRunner.query(`EXEC sp_rename 'cert.domain_catalog', 'area_catalog'`);
  }
}
