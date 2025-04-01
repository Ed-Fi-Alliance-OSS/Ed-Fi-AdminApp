import { GetSessionDataDto, PostUserDto, PutUserDto, toGetUserDto } from '@edanalytics/models';
import { User, addUserCreating, addUserModifying } from '@edanalytics/models-server';
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Authorize } from '../auth/authorization';
import { ReqUser } from '../auth/helpers/user.decorator';
import { ValidationHttpException, postYopassAuth0Secret, throwNotFound } from '../utils';
import { UsersGlobalService } from './users-global.service';
import { Auth0Service } from '../auth0/auth0.service';

@ApiTags('User - Global')
@Controller()
export class UsersGlobalController {
  constructor(
    private readonly userService: UsersGlobalService,
    private readonly auth0Service: Auth0Service,
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
      if (createUserDto.userType === 'machine') {
        // For machine users, we check for a user existing first
        // That way, we don't have to create a new application if the user already exists
        // And we don't have to update create a user, create an application, and then update the user with the client ID
        const possibleExistingUser = await this.userService
          .findByUsername(createUserDto.username)
          .catch(() => null);
        if (possibleExistingUser) {
          throw new ValidationHttpException({
            field: 'username',
            message: 'Username already exists',
          });
        }

        const application = await this.auth0Service.createApplication({
          name: createUserDto.username,
          description: createUserDto.description,
        });
        createUserDto.clientId = application.client_id;

        const yopass = await postYopassAuth0Secret({
          clientId: application.client_id,
          clientSecret: application.client_secret,
        });

        const createdUser = (await this.userService.create(
          addUserCreating(createUserDto, user)
        )) as User & { yopassLink: string };
        createdUser.yopassLink = yopass.link;
        return toGetUserDto(createdUser);
      }

      return toGetUserDto(await this.userService.create(addUserCreating(createUserDto, user)));
    } catch (error) {
      if (error?.code === '23505') {
        throw new ValidationHttpException({
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
        throw new ValidationHttpException({
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
