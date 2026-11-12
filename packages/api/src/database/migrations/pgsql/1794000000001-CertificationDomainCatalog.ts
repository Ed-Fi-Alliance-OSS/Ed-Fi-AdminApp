import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AC-649: scenario groups are called Domains, so cert.area_catalog becomes cert.domain_catalog
 * and areaId becomes domainId. A rename, not a rebuild: the catalog rows are kept.
 */
export class CertificationDomainCatalog1794000000001 implements MigrationInterface {
  name = 'CertificationDomainCatalog1794000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cert"."area_catalog" RENAME TO "domain_catalog"`);
    await queryRunner.query(
      `ALTER TABLE "cert"."domain_catalog" RENAME COLUMN "areaId" TO "domainId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cert"."scenario_catalog" RENAME COLUMN "areaId" TO "domainId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cert"."domain_catalog" RENAME CONSTRAINT "PK_cert_area_catalog" TO "PK_cert_domain_catalog"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cert"."domain_catalog" RENAME CONSTRAINT "FK_cert_area_catalog_catalogVersion" TO "FK_cert_domain_catalog_catalogVersion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cert"."scenario_catalog" RENAME CONSTRAINT "FK_cert_scenario_catalog_area" TO "FK_cert_scenario_catalog_domain"`,
    );
    // Renaming a table or column leaves the SERIAL sequence with its old name.
    await queryRunner.query(
      `ALTER SEQUENCE "cert"."area_catalog_areaId_seq" RENAME TO "domain_catalog_domainId_seq"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER SEQUENCE "cert"."domain_catalog_domainId_seq" RENAME TO "area_catalog_areaId_seq"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cert"."scenario_catalog" RENAME CONSTRAINT "FK_cert_scenario_catalog_domain" TO "FK_cert_scenario_catalog_area"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cert"."domain_catalog" RENAME CONSTRAINT "FK_cert_domain_catalog_catalogVersion" TO "FK_cert_area_catalog_catalogVersion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cert"."domain_catalog" RENAME CONSTRAINT "PK_cert_domain_catalog" TO "PK_cert_area_catalog"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cert"."scenario_catalog" RENAME COLUMN "domainId" TO "areaId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cert"."domain_catalog" RENAME COLUMN "domainId" TO "areaId"`,
    );
    await queryRunner.query(`ALTER TABLE "cert"."domain_catalog" RENAME TO "area_catalog"`);
  }
}
