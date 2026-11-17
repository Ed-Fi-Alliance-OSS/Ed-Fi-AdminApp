import {
  toCertificationDomainDto,
  toCertificationCatalogVersionDto,
  toCertificationStepDto,
} from '@edanalytics/models';
import { Controller, Get, Param, ParseIntPipe, Query, UseInterceptors } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { SbEnvironmentEdfiTenantInterceptor } from '../app/sb-environment-edfi-tenant.interceptor';
import { Authorize } from '../auth/authorization';
import { CatalogQueryService } from './catalog/catalog-query.service';
import { CERT_READ, CERT_TENANT_PATH, CERT_TENANT_SUBJECT } from './certification-authorization';
import { CertificationSupportInterceptor } from './certification-support.interceptor';

/**
 * Read-only access to the certification catalog synced from the artifact.
 * The catalog is the same for every tenant. The routes are still scoped to a team's tenant so
 * that only a user who may read certifications there gets it, an unknown tenant is a 404, and
 * an environment below Ed-Fi Data Model 5.0.0 is refused (400).
 */
@ApiTags('Certification')
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor, CertificationSupportInterceptor)
@Controller(CERT_TENANT_PATH)
export class CertificationCatalogController {
  constructor(private readonly catalogQueryService: CatalogQueryService) {}

  @Get('catalog-versions')
  @Authorize({ privilege: CERT_READ, subject: CERT_TENANT_SUBJECT })
  async getCatalogVersions(
    @Param('teamId', new ParseIntPipe()) _teamId: number,
    @Param('edfiTenantId', new ParseIntPipe()) _edfiTenantId: number,
  ) {
    return toCertificationCatalogVersionDto(await this.catalogQueryService.findCatalogVersions());
  }

  @Get('scenarios')
  @ApiQuery({ name: 'catalogVersionId', required: false, type: Number })
  @Authorize({ privilege: CERT_READ, subject: CERT_TENANT_SUBJECT })
  async getScenarios(
    @Param('teamId', new ParseIntPipe()) _teamId: number,
    @Param('edfiTenantId', new ParseIntPipe()) _edfiTenantId: number,
    @Query('catalogVersionId', new ParseIntPipe({ optional: true })) catalogVersionId?: number,
  ) {
    return toCertificationDomainDto(
      await this.catalogQueryService.findDomainsWithScenarios(catalogVersionId),
    );
  }

  @Get('steps')
  @ApiQuery({ name: 'scenarioId', required: false, type: Number })
  @Authorize({ privilege: CERT_READ, subject: CERT_TENANT_SUBJECT })
  async getSteps(
    @Param('teamId', new ParseIntPipe()) _teamId: number,
    @Param('edfiTenantId', new ParseIntPipe()) _edfiTenantId: number,
    @Query('scenarioId', new ParseIntPipe({ optional: true })) scenarioId?: number,
  ) {
    return toCertificationStepDto(
      await this.catalogQueryService.findStepsWithParameters(scenarioId),
    );
  }
}
