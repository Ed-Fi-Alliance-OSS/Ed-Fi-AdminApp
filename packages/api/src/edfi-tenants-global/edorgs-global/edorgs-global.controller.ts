import { toGetEdorgDto } from '@edanalytics/models';
import { Controller, Get, Param, ParseIntPipe, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Authorize } from '../../auth/authorization';
import { EdorgsGlobalService } from './edorgs-global.service';
import { SbEnvironmentEdfiTenantInterceptor } from '../../app/sb-environment-edfi-tenant.interceptor';

@ApiTags('Global - Edorg')
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor)
@Controller()
export class EdorgsGlobalController {
  constructor(private readonly edorgService: EdorgsGlobalService) {}

  @Get()
  @Authorize({
    privilege: 'edorg:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findAll(@Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number) {
    return toGetEdorgDto(await this.edorgService.findAll(edfiTenantId));
  }

  @Get(':edorgId')
  @Authorize({
    privilege: 'edorg:read',
    subject: {
      id: 'edorgId',
    },
  })
  async findOne(
    @Param('edorgId', new ParseIntPipe()) edorgId: number,
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number
  ) {
    return toGetEdorgDto(await this.edorgService.findOne(edfiTenantId, +edorgId));
  }
}
