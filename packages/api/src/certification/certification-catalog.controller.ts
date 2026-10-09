import {
  toCertificationAreaDto,
  toCertificationCatalogVersionDto,
  toCertificationStepDto,
} from '@edanalytics/models';
import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { Authorize } from '../auth/authorization';
import { CatalogQueryService } from './catalog/catalog-query.service';

/**
 * Read-only access to the certification catalog synced from the artifact.
 * The catalog is not tenant-specific, so routes are scoped to the environment only.
 */
@ApiTags('Certification')
@Controller('sb-environments/:sbEnvironmentId/certification')
export class CertificationCatalogController {
  constructor(private readonly catalogQueryService: CatalogQueryService) {}

  @Get('catalog-versions')
  @Authorize({ privilege: 'sb-environment:read', subject: { id: 'sbEnvironmentId' } })
  async getCatalogVersions() {
    return toCertificationCatalogVersionDto(await this.catalogQueryService.findCatalogVersions());
  }

  @Get('scenarios')
  @ApiQuery({ name: 'catalogVersionId', required: false, type: Number })
  @Authorize({ privilege: 'sb-environment:read', subject: { id: 'sbEnvironmentId' } })
  async getScenarios(
    @Query('catalogVersionId', new ParseIntPipe({ optional: true })) catalogVersionId?: number,
  ) {
    return toCertificationAreaDto(
      await this.catalogQueryService.findAreasWithScenarios(catalogVersionId),
    );
  }

  @Get('steps')
  @ApiQuery({ name: 'scenarioId', required: false, type: Number })
  @Authorize({ privilege: 'sb-environment:read', subject: { id: 'sbEnvironmentId' } })
  async getSteps(@Query('scenarioId', new ParseIntPipe({ optional: true })) scenarioId?: number) {
    return toCertificationStepDto(
      await this.catalogQueryService.findStepsWithParameters(scenarioId),
    );
  }
}
