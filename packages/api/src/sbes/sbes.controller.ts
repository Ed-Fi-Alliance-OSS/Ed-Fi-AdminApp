import {
  GetSessionDataDto,
  PostSbeDto,
  PutSbeDto,
  toGetSbeDto,
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
import { SbesService } from './sbes.service';
import { ApiTags } from '@nestjs/swagger';
import { addUserCreating, addUserModifying } from '@edanalytics/models-server';

@ApiTags('Sbe')
@Controller()
export class SbesController {
  constructor(private readonly sbeService: SbesService) {}

  @Post()
  async create(
    @Body() createSbeDto: PostSbeDto,
    @ReqUser() session: GetSessionDataDto,
    @Param('tenantId', new ParseIntPipe()) tenantId: number
  ) {
    return toGetSbeDto(
      await this.sbeService.create(addUserCreating(createSbeDto, session.user))
    );
  }

  @Get()
  async findAll(@Param('tenantId', new ParseIntPipe()) tenantId: number) {
    return toGetSbeDto(await this.sbeService.findAll(tenantId));
  }

  @Get(':sbeId')
  async findOne(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number
  ) {
    return toGetSbeDto(await this.sbeService.findOne(tenantId, +sbeId));
  }

  @Put(':sbeId')
  async update(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Body() updateSbeDto: PutSbeDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetSbeDto(
      await this.sbeService.update(
        tenantId,
        sbeId,
        addUserModifying(updateSbeDto, session.user)
      )
    );
  }

  @Delete(':sbeId')
  remove(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqUser() session: GetSessionDataDto
  ) {
    return this.sbeService.remove(tenantId, +sbeId, session.user);
  }
}
