import {
  addUserCreating,
  addUserModifying,
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
import { ReqUser } from '../auth/user.decorator';
import { SbesService } from './sbes.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Environment')
@Controller()
export class SbesController {
  constructor(private readonly sbeService: SbesService) { }

  @Post()
  async create(
    @Body() createSbeDto: PostSbeDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetSbeDto(
      await this.sbeService.create(addUserCreating(createSbeDto, session.user))
    );
  }

  @Get()
  async findAll() {
    return toGetSbeDto(await this.sbeService.findAll());
  }

  @Get(':sbeId')
  async findOne(@Param('sbeId', new ParseIntPipe()) sbeId: number) {
    return toGetSbeDto(await this.sbeService.findOne(+sbeId));
  }

  @Put(':sbeId')
  async update(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Body() updateSbeDto: PutSbeDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetSbeDto(
      await this.sbeService.update(
        sbeId,
        addUserModifying(updateSbeDto, session.user)
      )
    );
  }

  @Delete(':sbeId')
  remove(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @ReqUser() session: GetSessionDataDto
  ) {
    return this.sbeService.remove(+sbeId, session.user);
  }
}
