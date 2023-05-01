import {
  toGetEdorgDto,
  toGetOdsDto,
  toGetOwnershipDto,
  toGetRoleDto,
  toGetSbeDto,
  toGetUserDto,
  toGetUserTenantMembershipDto
} from '@edanalytics/models';
import {
  Controller,
  Get,
  Param,
  ParseIntPipe
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenantResourcesService } from './tenant-resources.service';

@ApiTags('Tenant Resources')
@Controller()
export class TenantResourcesController {
  constructor(private readonly tenantResourcesService: TenantResourcesService) { }

  @Get('sbes')
  async getSbes(
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
  ) {
    return toGetSbeDto(await this.tenantResourcesService.getSbes(tenantId));
  }
  @Get('sbes/:sbeId/odss')
  async getOdss(
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
  ) {
    return toGetOdsDto(await this.tenantResourcesService.getOdss(tenantId, sbeId));
  }
  @Get('sbes/:sbeId/edorgs')
  async getEdorgs(
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
  ) {
    return toGetEdorgDto(await this.tenantResourcesService.getEdorgs(tenantId, sbeId));
  }
  @Get('roles')
  async getRoles(
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
  ) {
    return toGetRoleDto(await this.tenantResourcesService.getRoles(tenantId));
  }
  @Get('user-tenant-memberships')
  async getUserTenantMemberships(
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
  ) {
    return toGetUserTenantMembershipDto(await this.tenantResourcesService.getUserTenantMemberships(tenantId));
  }
  @Get('users')
  async getUsers(
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
  ) {
    return toGetUserDto(await this.tenantResourcesService.getUsers(tenantId));
  }
  @Get('ownerships')
  async getOwnerships(
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
  ) {
    return toGetOwnershipDto(await this.tenantResourcesService.getOwnerships(tenantId));
  }

}
