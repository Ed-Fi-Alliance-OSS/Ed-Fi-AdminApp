import { GetSessionDataDto, PostUserDto, PutUserDto, toGetUserDto } from '@edanalytics/models';
import { User, addUserCreating, addUserModifying } from '@edanalytics/models-server';
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Authorize } from '../auth/authorization';
import { ReqUser } from '../auth/helpers/user.decorator';
import { FormValidationException, throwNotFound } from '../utils';
import { UsersGlobalService } from './users-global.service';

@ApiTags('User - Global')
@Controller()
export class UsersGlobalController {
  constructor(
    private readonly userService: UsersGlobalService,
    @InjectRepository(User)
    private usersRepository: Repository<User>
  ) {}

  @Post()
  @Authorize({
    privilege: 'user:create',
    subject: {
      id: '__filtered__',
    },
  })
  async create(@Body() createUserDto: PostUserDto, @ReqUser() user: GetSessionDataDto) {
    try {
      return toGetUserDto(await this.userService.create(addUserCreating(createUserDto, user)));
    } catch (error) {
      if (error?.code === '23505') {
        throw new FormValidationException({
          field: 'username',
          message: 'Username already exists',
        });
      }
      throw error;
    }
  }

  @Get()
  @Authorize({
    privilege: 'user:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findAll() {
    return toGetUserDto(await this.usersRepository.find());
  }

  @Get(':userId')
  @Authorize({
    privilege: 'user:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findOne(@Param('userId', new ParseIntPipe()) userId: number) {
    return toGetUserDto(await this.userService.findOne(userId).catch(throwNotFound));
  }

  @Put(':userId')
  @Authorize({
    privilege: 'user:update',
    subject: {
      id: '__filtered__',
    },
  })
  async update(
    @Param('userId', new ParseIntPipe()) userId: number,
    @Body() updateUserDto: PutUserDto,
    @ReqUser() user: GetSessionDataDto
  ) {
    try {
      return toGetUserDto(
        await this.userService.update(userId, addUserModifying(updateUserDto, user))
      );
    } catch (error) {
      if (error?.code === '23505') {
        throw new FormValidationException({
          field: 'username',
          message: 'Username already exists',
        });
      }
      throw error;
    }
  }

  @Delete(':userId')
  @Authorize({
    privilege: 'user:delete',
    subject: {
      id: '__filtered__',
    },
  })
  remove(@Param('userId', new ParseIntPipe()) userId: number, @ReqUser() user: GetSessionDataDto) {
    return this.userService.remove(userId, user);
  }
}
