import { GetSessionDataDto } from '@edanalytics/models';
import { Controller, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReqUser } from '../auth/helpers/user.decorator';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@Controller()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Put('sbes/:sbeId/refresh-resources')
  async update(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @ReqUser() session: GetSessionDataDto
  ) {
    await this.adminService.sbeRefreshResources(sbeId, session.user);
    return undefined;
  }
}
