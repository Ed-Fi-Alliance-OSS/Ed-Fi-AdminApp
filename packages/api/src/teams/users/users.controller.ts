import { toGetUserDto } from '@edanalytics/models';
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Authorize } from '../../auth/authorization';
import { UsersService } from './users.service';

@ApiTags('User')
@Controller()
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @Authorize({
    privilege: 'team.user:read',
    subject: {
      id: '__filtered__',
      teamId: 'teamId',
    },
  })
  @Get()
  async findAll(@Param('teamId', new ParseIntPipe()) teamId: number) {
    return toGetUserDto(await this.userService.findAll(teamId));
  }

  @Get(':userId')
  @Authorize({
    privilege: 'team.user:read',
    subject: {
      id: 'userId',
      teamId: 'teamId',
    },
  })
  async findOne(
    @Param('userId', new ParseIntPipe()) userId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number
  ) {
    return toGetUserDto(await this.userService.findOne(teamId, +userId));
  }
}
