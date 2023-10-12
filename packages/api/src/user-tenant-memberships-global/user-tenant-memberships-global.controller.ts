import {
  GetSessionDataDto,
  PostUserTenantMembershipDto,
  PutUserTenantMembershipDto,
  toGetUserTenantMembershipDto,
} from '@edanalytics/models';
import {
  UserTenantMembership,
  addUserCreating,
  addUserModifying,
} from '@edanalytics/models-server';
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Authorize } from '../auth/authorization';
import { ReqUser } from '../auth/helpers/user.decorator';
import { ValidationHttpException, throwNotFound } from '../utils';
import { UserTenantMembershipsGlobalService } from './user-tenant-memberships-global.service';

@ApiTags('UserTenantMembership - Global')
@Controller()
export class UserTenantMembershipsGlobalController {
  constructor(
    private readonly userTenantMembershipService: UserTenantMembershipsGlobalService,
    @InjectRepository(UserTenantMembership)
    private userTenantMembershipsRepository: Repository<UserTenantMembership>
  ) {}

  @Post()
  @Authorize({
    privilege: 'user-tenant-membership:create',
    subject: {
      id: '__filtered__',
    },
  })
  async create(
    @Body() createUserTenantMembershipDto: PostUserTenantMembershipDto,
    @ReqUser() user: GetSessionDataDto
  ) {
    const isRedundant = !!(
      await this.userTenantMembershipsRepository.findBy({
        tenantId: createUserTenantMembershipDto.tenantId,
        userId: createUserTenantMembershipDto.userId,
      })
    ).length;

    if (isRedundant) {
      throw new ValidationHttpException({
        field: 'tenantId',
        message:
          'A membership already exists for this tenant\u2013user combination. To minimize confusion we disallow duplication.',
      });
    }
    return toGetUserTenantMembershipDto(
      await this.userTenantMembershipService.create(
        addUserCreating(createUserTenantMembershipDto, user)
      )
    );
  }

  @Get()
  @Authorize({
    privilege: 'user-tenant-membership:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findAll() {
    return toGetUserTenantMembershipDto(await this.userTenantMembershipsRepository.find());
  }

  @Get(':userTenantMembershipId')
  @Authorize({
    privilege: 'user-tenant-membership:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findOne(
    @Param('userTenantMembershipId', new ParseIntPipe())
    userTenantMembershipId: number
  ) {
    return toGetUserTenantMembershipDto(
      await this.userTenantMembershipService.findOne(userTenantMembershipId).catch(throwNotFound)
    );
  }

  @Put(':userTenantMembershipId')
  @Authorize({
    privilege: 'user-tenant-membership:update',
    subject: {
      id: '__filtered__',
    },
  })
  async update(
    @Param('userTenantMembershipId', new ParseIntPipe())
    userTenantMembershipId: number,
    @Body() updateUserTenantMembershipDto: PutUserTenantMembershipDto,
    @ReqUser() user: GetSessionDataDto
  ) {
    return toGetUserTenantMembershipDto(
      await this.userTenantMembershipService.update(
        userTenantMembershipId,
        addUserModifying(updateUserTenantMembershipDto, user)
      )
    );
  }

  @Delete(':userTenantMembershipId')
  @Authorize({
    privilege: 'user-tenant-membership:delete',
    subject: {
      id: '__filtered__',
    },
  })
  remove(
    @Param('userTenantMembershipId', new ParseIntPipe())
    userTenantMembershipId: number,
    @ReqUser() user: GetSessionDataDto
  ) {
    return this.userTenantMembershipService.remove(userTenantMembershipId, user);
  }
}
