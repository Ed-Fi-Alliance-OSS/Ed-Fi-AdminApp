import { AuthorizationCache, GetSessionDataDto, Ids, PostCertificationRunDto } from '@edanalytics/models';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ReqEdfiTenant,
  ReqSbEnvironment,
  SbEnvironmentEdfiTenantInterceptor,
} from '../app/sb-environment-edfi-tenant.interceptor';
import { Authorize } from '../auth/authorization';
import { AuthCache } from '../auth/helpers/inject-auth-cache';
import { InjectFilter } from '../auth/helpers/inject-filter';
import { ReqUser } from '../auth/helpers/user.decorator';
import { checkId } from '../auth/helpers/where-ids';
import {
  CERT_READ,
  CERT_RUN,
  CERT_TENANT_PATH,
  CERT_TENANT_SUBJECT,
} from './certification-authorization';
import { CertificationRunsService } from './certification-runs.service';
import { CertificationSupportInterceptor } from './certification-support.interceptor';

/** Starting a run on one of the team's data stores, and what the Start Run popup needs (AC-651). */
@ApiTags('Certification')
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor, CertificationSupportInterceptor)
@Controller(`${CERT_TENANT_PATH}/runs`)
export class CertificationRunsController {
  constructor(private readonly runsService: CertificationRunsService) {}

  /** Starts a Draft run. 409 when the data store already has an open run of the model. */
  @Post()
  @Authorize({ privilege: CERT_RUN, subject: CERT_TENANT_SUBJECT })
  async createRun(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @Body() body: PostCertificationRunDto,
    @InjectFilter(CERT_RUN) validOdsIds: Ids,
    @ReqUser() session?: GetSessionDataDto,
  ) {
    if (!checkId(body.odsId, validOdsIds)) throw new NotFoundException();
    return this.runsService.createRun({
      teamId,
      sbEnvironment,
      edfiTenant,
      odsId: body.odsId,
      certificationModel: body.certificationModel,
      userId: session?.id ?? null,
    });
  }

  /** The newest run of each Certification Model on a data store, so the popup can disable a model with an open run. */
  @Get('latest')
  @Authorize({ privilege: CERT_READ, subject: CERT_TENANT_SUBJECT })
  async getLatestRuns(
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @Query('odsId', new ParseIntPipe()) odsId: number,
    @InjectFilter(CERT_READ) validOdsIds: Ids,
  ) {
    if (!checkId(odsId, validOdsIds)) throw new NotFoundException();
    return this.runsService.findLatestRuns({ edfiTenantId, odsId });
  }
}

/**
 * One run by its ID alone. The Scenarios page's address only has the run, so this is how the
 * page learns the run's environment, tenant and data store.
 */
@ApiTags('Certification')
@Controller('teams/:teamId/certification/runs')
export class CertificationTeamRunsController {
  constructor(private readonly runsService: CertificationRunsService) {}

  /**
   * The guard can only check team membership here, because the tenant isn't in the route.
   * certification:read is then checked on the run's own tenant and data store; a run the user
   * may not see is a 404.
   */
  @Get(':runId')
  @Authorize({
    privilege: 'team.sb-environment:read',
    subject: { id: '__filtered__', teamId: 'teamId' },
  })
  async getRun(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Param('runId', new ParseIntPipe()) runId: number,
    @AuthCache() authorizationCache: AuthorizationCache,
  ) {
    const certificationRun = await this.runsService.findTeamRun({
      runId,
      teamId,
      validOdsIds: (edfiTenantId) => authorizationCache?.[CERT_READ]?.[edfiTenantId],
    });
    return this.runsService.toDto(certificationRun);
  }
}
