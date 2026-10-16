import { PostCertificationStepRunDto, toCertificationStepRunDto } from '@edanalytics/models';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  ServiceUnavailableException,
  UseInterceptors,
} from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import {
  ReqEdfiTenant,
  ReqSbEnvironment,
  SbEnvironmentEdfiTenantInterceptor,
} from '../app/sb-environment-edfi-tenant.interceptor';
import { Authorize } from '../auth/authorization';
import { CertificationStepRunsService } from './certification-step-runs.service';
import { CertificationService } from './certification.service';

const RETRY_AFTER_SECONDS = '30';

@ApiTags('Certification')
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor)
@Controller('sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/certification')
export class CertificationController {
  constructor(
    private readonly certificationService: CertificationService,
    private readonly stepRunsService: CertificationStepRunsService,
  ) {}

  /** Runs one certification step through the Bruno CLI and returns its saved result (AC-466). */
  @Post('sis/:sisVersion/steps/:stepId/run')
  @HttpCode(200)
  @Authorize({ privilege: 'sb-environment:update', subject: { id: 'sbEnvironmentId' } })
  async runStep(
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('sisVersion') sisVersion: string,
    @Param('stepId', ParseIntPipe) stepId: number,
    @Body() body: PostCertificationStepRunDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.certificationService.runStep({
        sbEnvironment,
        edfiTenant,
        sisVersion,
        stepId,
        odsId: body.odsId,
        token: body.token,
        inputs: body.inputs,
      });
      return toCertificationStepRunDto(result);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        res.setHeader('Retry-After', RETRY_AFTER_SECONDS);
      }
      throw error;
    }
  }

  /**
   * The saved result of each step of one scenario (AC-475). Read-only: it never creates a
   * certification process and never contacts the ODS/API, so it needs no token.
   */
  @Get('sis/:sisVersion/step-runs')
  @ApiQuery({ name: 'odsId', required: false, type: Number })
  @Authorize({ privilege: 'sb-environment:read', subject: { id: 'sbEnvironmentId' } })
  async getStepRuns(
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('sisVersion') sisVersion: string,
    @Query('scenarioId', ParseIntPipe) scenarioId: number,
    @Query('odsId', new ParseIntPipe({ optional: true })) odsId?: number,
  ) {
    return this.stepRunsService.findStepRuns({
      edfiTenantId: edfiTenant.id,
      odsId: odsId ?? null,
      sisVersion,
      scenarioId,
    });
  }
}
