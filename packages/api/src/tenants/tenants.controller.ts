import {
  addUserCreating,
  addUserModifying,
  GetSessionDataDto,
  PostTenantDto,
  PutTenantDto,
  toGetTenantDto,
} from '@edanalytics/models';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ReqUser } from '../auth/user.decorator';
import { TenantsService } from './tenants.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Tenant')
@Controller()
export class TenantsController {
  constructor(private readonly tenantService: TenantsService) {}

  @Post()
  async create(
    @Body() createTenantDto: PostTenantDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetTenantDto(
      await this.tenantService.create(
        addUserCreating(createTenantDto, session.user)
      )
    );
  }

  @Get()
  async findAll() {
    return toGetTenantDto(await this.tenantService.findAll());
  }

  @Get(':tenantId')
  async findOne(@Param('tenantId', new ParseIntPipe()) tenantId: number) {
    return toGetTenantDto(await this.tenantService.findOne(+tenantId));
  }

  @Put(':tenantId')
  async update(
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Body() updateTenantDto: PutTenantDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetTenantDto(
      await this.tenantService.update(
        tenantId,
        addUserModifying(updateTenantDto, session.user)
      )
    );
  }

  @Delete(':tenantId')
  remove(
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqUser() session: GetSessionDataDto
  ) {
    return this.tenantService.remove(+tenantId, session.user);
  }
}
