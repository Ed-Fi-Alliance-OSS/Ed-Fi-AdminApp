import {
  addUserCreating,
  addUserModifying,
  GetSessionDataDto,
  PostRoleDto,
  PutRoleDto,
  toGetRoleDto,
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
import { RolesService } from './roles.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Role')
@Controller()
export class RolesController {
  constructor(private readonly roleService: RolesService) {}

  @Post()
  async create(
    @Body() createRoleDto: PostRoleDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetRoleDto(
      await this.roleService.create(
        addUserCreating(createRoleDto, session.user)
      )
    );
  }

  @Get()
  async findAll() {
    return toGetRoleDto(await this.roleService.findAll());
  }

  @Get(':roleId')
  async findOne(@Param('roleId', new ParseIntPipe()) roleId: number) {
    return toGetRoleDto(await this.roleService.findOne(+roleId));
  }

  @Put(':roleId')
  async update(
    @Param('roleId', new ParseIntPipe()) roleId: number,
    @Body() updateRoleDto: PutRoleDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetRoleDto(
      await this.roleService.update(
        roleId,
        addUserModifying(updateRoleDto, session.user)
      )
    );
  }

  @Delete(':roleId')
  remove(
    @Param('roleId', new ParseIntPipe()) roleId: number,
    @ReqUser() session: GetSessionDataDto
  ) {
    return this.roleService.remove(+roleId, session.user);
  }
}
