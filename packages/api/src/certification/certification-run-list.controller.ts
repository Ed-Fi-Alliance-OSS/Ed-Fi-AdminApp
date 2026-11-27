import { toCertificationDashboardListDto } from '@edanalytics/models';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Authorize } from '../auth/authorization';
import { CertificationRunListService } from './certification-run-list.service';

/** Global (not tenant-scoped) route, so no SbEnvironmentEdfiTenantInterceptor. */
@ApiTags('Certification')
@Controller('certification/runs')
export class CertificationRunListController {
  constructor(private readonly runListService: CertificationRunListService) {}

  @Get()
  @Authorize({ privilege: 'certification:read', subject: { id: '__filtered__' } })
  async getRuns() {
    return toCertificationDashboardListDto(await this.runListService.getRuns());
  }
}
