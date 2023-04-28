import {
  addUserCreating,
  addUserModifying,
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
import { ReqUser } from '../auth/user.decorator';
import { UsersService } from './users.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('User')
@Controller()
export class UsersController {
  constructor(private readonly userService: UsersService) { }

  @Post()
  async create(
    @Body() createUserDto: PostUserDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetUserDto(
      await this.userService.create(
        addUserCreating(createUserDto, session.user)
      )
    );
  }

  @Get()
  async findAll() {
    return toGetUserDto(await this.userService.findAll());
  }

  @Get(':userId')
  async findOne(@Param('userId', new ParseIntPipe()) userId: number) {
    return toGetUserDto(await this.userService.findOne(+userId));
  }

  @Put(':userId')
  async update(
    @Param('userId', new ParseIntPipe()) userId: number,
    @Body() updateUserDto: PutUserDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetUserDto(
      await this.userService.update(
        userId,
        addUserModifying(updateUserDto, session.user)
      )
    );
  }

  @Delete(':userId')
  remove(
    @Param('userId', new ParseIntPipe()) userId: number,
    @ReqUser() session: GetSessionDataDto
  ) {
    return this.userService.remove(+userId, session.user);
  }
}
