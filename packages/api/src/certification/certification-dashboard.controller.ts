import { toCertificationDashboardDto } from '@edanalytics/models';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Authorize } from '../auth/authorization';
import { CertificationDashboardService } from './certification-dashboard.service';

/** Global (not tenant-scoped) route, so no SbEnvironmentEdfiTenantInterceptor. */
@ApiTags('Certification')
@Controller('certification/dashboard')
export class CertificationDashboardController {
  constructor(private readonly dashboardService: CertificationDashboardService) {}

  @Get()
  @Authorize({ privilege: 'certification:read', subject: { id: '__filtered__' } })
  async getDashboard() {
    return toCertificationDashboardDto(await this.dashboardService.getDashboard());
  }
}
