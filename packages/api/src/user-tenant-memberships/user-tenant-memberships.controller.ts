import {
  GetSessionDataDto,
  PostUserTenantMembershipDto,
  PutUserTenantMembershipDto,
  toGetUserTenantMembershipDto,
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
import { ReqUser } from '../auth/helpers/user.decorator';
import { UserTenantMembershipsService } from './user-tenant-memberships.service';
import { ApiTags } from '@nestjs/swagger';
import { addUserCreating, addUserModifying } from '@edanalytics/models-server';

@ApiTags('UserTenantMembership')
@Controller()
export class UserTenantMembershipsController {
  constructor(
    private readonly userTenantMembershipService: UserTenantMembershipsService
  ) {}

  @Post()
  async create(
    @Body() createUserTenantMembershipDto: PostUserTenantMembershipDto,
    @ReqUser() session: GetSessionDataDto,
    @Param('tenantId', new ParseIntPipe()) tenantId: number
  ) {
    return toGetUserTenantMembershipDto(
      await this.userTenantMembershipService.create(
        addUserCreating(createUserTenantMembershipDto, session.user)
      )
    );
  }

  @Get()
  async findAll(@Param('tenantId', new ParseIntPipe()) tenantId: number) {
    return toGetUserTenantMembershipDto(
      await this.userTenantMembershipService.findAll(tenantId)
    );
  }

  @Get(':userTenantMembershipId')
  async findOne(
    @Param('userTenantMembershipId', new ParseIntPipe())
    userTenantMembershipId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number
  ) {
    return toGetUserTenantMembershipDto(
      await this.userTenantMembershipService.findOne(
        tenantId,
        +userTenantMembershipId
      )
    );
  }

  @Put(':userTenantMembershipId')
  async update(
    @Param('userTenantMembershipId', new ParseIntPipe())
    userTenantMembershipId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Body() updateUserTenantMembershipDto: PutUserTenantMembershipDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetUserTenantMembershipDto(
      await this.userTenantMembershipService.update(
        tenantId,
        userTenantMembershipId,
        addUserModifying(updateUserTenantMembershipDto, session.user)
      )
    );
  }

  @Delete(':userTenantMembershipId')
  remove(
    @Param('userTenantMembershipId', new ParseIntPipe())
    userTenantMembershipId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqUser() session: GetSessionDataDto
  ) {
    return this.userTenantMembershipService.remove(
      tenantId,
      +userTenantMembershipId,
      session.user
    );
  }
}
