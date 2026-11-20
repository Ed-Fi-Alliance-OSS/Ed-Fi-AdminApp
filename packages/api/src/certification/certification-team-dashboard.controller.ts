import { AuthorizationCache, toCertificationTeamDashboardDto } from '@edanalytics/models';
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Authorize } from '../auth/authorization';
import { AuthCache } from '../auth/helpers/inject-auth-cache';
import { CERT_READ } from './certification-authorization';
import { CertificationTeamDashboardService } from './certification-team-dashboard.service';

/** The vendor "My products" dashboard (AC-671): one team, across the data stores the user can read. */
@ApiTags('Certification')
@Controller('teams/:teamId/certification/dashboard')
export class CertificationTeamDashboardController {
  constructor(private readonly dashboardService: CertificationTeamDashboardService) {}

  /**
   * The guard can only check team membership here, because tenants aren't in the route.
   * certification:read is then applied per data store; unreadable ones are left out.
   */
  @Get()
  @Authorize({
    privilege: 'team.sb-environment:read',
    subject: { id: '__filtered__', teamId: 'teamId' },
  })
  async getDashboard(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @AuthCache() authorizationCache: AuthorizationCache,
  ) {
    return toCertificationTeamDashboardDto(
      await this.dashboardService.getDashboard({
        teamId,
        validOdsIds: (edfiTenantId) => authorizationCache?.[CERT_READ]?.[edfiTenantId],
      }),
    );
  }
}
