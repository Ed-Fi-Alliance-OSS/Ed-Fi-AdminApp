import { toGetOdsDto } from '@edanalytics/models';
import { Controller, Get, Param, ParseIntPipe, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Authorize } from '../../auth/authorization';
import { OdssGlobalService } from './odss-global.service';
import { SbEnvironmentEdfiTenantInterceptor } from '../../app/sb-environment-edfi-tenant.interceptor';

@ApiTags('Global - Ods')
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor)
@Controller()
export class OdssGlobalController {
  constructor(private readonly odsService: OdssGlobalService) {}

  @Get()
  @Authorize({
    privilege: 'ods:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findAll(@Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number) {
    return toGetOdsDto(await this.odsService.findAll(edfiTenantId));
  }

  @Get(':odsId')
  @Authorize({
    privilege: 'ods:read',
    subject: {
      id: 'odsId',
    },
  })
  async findOne(
    @Param('odsId', new ParseIntPipe()) odsId: number,
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number
  ) {
    return toGetOdsDto(await this.odsService.findOne(edfiTenantId, +odsId));
  }
}
