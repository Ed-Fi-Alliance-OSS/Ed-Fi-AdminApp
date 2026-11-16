import { Ids, PostCertificationStepRunDto, toCertificationStepRunDto } from '@edanalytics/models';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  ServiceUnavailableException,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import {
  ReqEdfiTenant,
  ReqSbEnvironment,
  SbEnvironmentEdfiTenantInterceptor,
} from '../app/sb-environment-edfi-tenant.interceptor';
import { Authorize } from '../auth/authorization';
import { InjectFilter } from '../auth/helpers/inject-filter';
import {
  CERT_READ,
  CERT_RUN,
  CERT_TENANT_PATH,
  CERT_TENANT_SUBJECT,
} from './certification-authorization';
import { CertificationRunsService } from './certification-runs.service';
import { CertificationStepRunsService } from './certification-step-runs.service';
import { CertificationSupportInterceptor } from './certification-support.interceptor';
import { CertificationService } from './certification.service';

const RETRY_AFTER_SECONDS = '30';

/**
 * Working on one certification run: running its steps and reading their results. Every route
 * first loads the run for the team, so a run of another team, tenant or data store is a 404.
 */
@ApiTags('Certification')
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor, CertificationSupportInterceptor)
@Controller(`${CERT_TENANT_PATH}/runs/:runId`)
export class CertificationController {
  constructor(
    private readonly certificationService: CertificationService,
    private readonly stepRunsService: CertificationStepRunsService,
    private readonly runsService: CertificationRunsService,
  ) {}

  private findRun(teamId: number, edfiTenant: EdfiTenant, runId: number, validOdsIds: Ids) {
    return this.runsService.findTeamRun({
      runId,
      teamId,
      edfiTenantId: edfiTenant.id,
      validOdsIds: () => validOdsIds,
    });
  }

  /** Runs one certification step through the Bruno CLI and returns its saved result (AC-466). */
  @Post('steps/:stepId/run')
  @HttpCode(200)
  @Authorize({ privilege: CERT_RUN, subject: CERT_TENANT_SUBJECT })
  async runStep(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('runId', new ParseIntPipe()) runId: number,
    @Param('stepId', new ParseIntPipe()) stepId: number,
    @Body() body: PostCertificationStepRunDto,
    @InjectFilter(CERT_RUN) validOdsIds: Ids,
    @Res({ passthrough: true }) res: Response,
  ) {
    const certificationRun = await this.findRun(teamId, edfiTenant, runId, validOdsIds);
    try {
      const result = await this.certificationService.runStep({
        sbEnvironment,
        edfiTenant,
        certificationRun,
        stepId,
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
   * The saved result of each step of one scenario (AC-475). Read-only: it never contacts the
   * ODS/API, so it needs no token.
   */
  @Get('step-runs')
  @Authorize({ privilege: CERT_READ, subject: CERT_TENANT_SUBJECT })
  async getStepRuns(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('runId', new ParseIntPipe()) runId: number,
    @Query('scenarioId', new ParseIntPipe()) scenarioId: number,
    @InjectFilter(CERT_READ) validOdsIds: Ids,
  ) {
    const { certificationRunId } = await this.findRun(teamId, edfiTenant, runId, validOdsIds);
    return this.stepRunsService.findStepRuns({ certificationRunId, scenarioId });
  }

  /** The run's status and its scenario statuses (AC-689, AC-649). Read-only, needs no token. */
  @Get('scenario-statuses')
  @Authorize({ privilege: CERT_READ, subject: CERT_TENANT_SUBJECT })
  async getScenarioStatuses(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('runId', new ParseIntPipe()) runId: number,
    @InjectFilter(CERT_READ) validOdsIds: Ids,
  ) {
    return this.stepRunsService.findScenarioStatuses(
      await this.findRun(teamId, edfiTenant, runId, validOdsIds),
    );
  }

  /**
   * The decrypted Ed-Fi API response snapshot of one step's latest run (AC-690). Loaded only
   * when the vendor opens it, so the step list never carries the bodies.
   */
  @Get('step-runs/:stepId/snapshot')
  // The body is a decrypted vendor response: no browser or proxy may keep a copy.
  @Header('Cache-Control', 'no-store')
  @Authorize({ privilege: CERT_READ, subject: CERT_TENANT_SUBJECT })
  async getStepSnapshot(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Param('runId', new ParseIntPipe()) runId: number,
    @Param('stepId', new ParseIntPipe()) stepId: number,
    @InjectFilter(CERT_READ) validOdsIds: Ids,
  ) {
    const { certificationRunId } = await this.findRun(teamId, edfiTenant, runId, validOdsIds);
    return this.stepRunsService.findStepSnapshot({ certificationRunId, stepId });
  }
}
