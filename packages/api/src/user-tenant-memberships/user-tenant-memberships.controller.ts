import {
  addUserCreating,
  addUserModifying,
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
import { ReqUser } from '../auth/user.decorator';
import { UserTenantMembershipsService } from './user-tenant-memberships.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('UserTenantMembership')
@Controller()
export class UserTenantMembershipsController {
  constructor(
    private readonly userTenantMembershipService: UserTenantMembershipsService
  ) {}

  @Post()
  async create(
    @Body() createUserTenantMembershipDto: PostUserTenantMembershipDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetUserTenantMembershipDto(
      await this.userTenantMembershipService.create(
        addUserCreating(createUserTenantMembershipDto, session.user)
      )
    );
  }

  @Get()
  async findAll() {
    return toGetUserTenantMembershipDto(
      await this.userTenantMembershipService.findAll()
    );
  }

  @Get(':userTenantMembershipId')
  async findOne(
    @Param('userTenantMembershipId', new ParseIntPipe())
    userTenantMembershipId: number
  ) {
    return toGetUserTenantMembershipDto(
      await this.userTenantMembershipService.findOne(+userTenantMembershipId)
    );
  }

  @Put(':userTenantMembershipId')
  async update(
    @Param('userTenantMembershipId', new ParseIntPipe())
    userTenantMembershipId: number,
    @Body() updateUserTenantMembershipDto: PutUserTenantMembershipDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetUserTenantMembershipDto(
      await this.userTenantMembershipService.update(
        userTenantMembershipId,
        addUserModifying(updateUserTenantMembershipDto, session.user)
      )
    );
  }

  @Delete(':userTenantMembershipId')
  remove(
    @Param('userTenantMembershipId', new ParseIntPipe())
    userTenantMembershipId: number,
    @ReqUser() session: GetSessionDataDto
  ) {
    return this.userTenantMembershipService.remove(
      +userTenantMembershipId,
      session.user
    );
  }
}
