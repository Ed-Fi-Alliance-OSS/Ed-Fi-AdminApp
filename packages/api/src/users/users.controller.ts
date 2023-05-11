import {
  GetSessionDataDto,
  PostUserDto,
  PutUserDto,
  toGetUserDto,
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
import { UsersService } from './users.service';
import { ApiTags } from '@nestjs/swagger';
import { addUserCreating, addUserModifying } from '@edanalytics/models-server';

@ApiTags('User')
@Controller()
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @Post()
  async create(
    @Body() createUserDto: PostUserDto,
    @ReqUser() session: GetSessionDataDto,
    @Param('tenantId', new ParseIntPipe()) tenantId: number
  ) {
    return toGetUserDto(
      await this.userService.create(
        addUserCreating(createUserDto, session.user)
      )
    );
  }

  @Get()
  async findAll(@Param('tenantId', new ParseIntPipe()) tenantId: number) {
    return toGetUserDto(await this.userService.findAll(tenantId));
  }

  @Get(':userId')
  async findOne(
    @Param('userId', new ParseIntPipe()) userId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number
  ) {
    return toGetUserDto(await this.userService.findOne(tenantId, +userId));
  }

  @Put(':userId')
  async update(
    @Param('userId', new ParseIntPipe()) userId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Body() updateUserDto: PutUserDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetUserDto(
      await this.userService.update(
        tenantId,
        userId,
        addUserModifying(updateUserDto, session.user)
      )
    );
  }

  @Delete(':userId')
  remove(
    @Param('userId', new ParseIntPipe()) userId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqUser() session: GetSessionDataDto
  ) {
    return this.userService.remove(tenantId, +userId, session.user);
  }
}
