import {
  addUserCreating,
  addUserModifying,
  GetSessionDataDto,
  PostEdorgDto,
  PutEdorgDto,
  toGetEdorgDto,
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
import { EdorgsService } from './edorgs.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Ed-Org')
@Controller()
export class EdorgsController {
  constructor(private readonly edorgService: EdorgsService) { }

  @Post()
  async create(
    @Body() createEdorgDto: PostEdorgDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetEdorgDto(
      await this.edorgService.create(
        addUserCreating(createEdorgDto, session.user)
      )
    );
  }

  @Get()
  async findAll(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
  ) {
    return toGetEdorgDto(await this.edorgService.findAll(sbeId));
  }

  @Get(':edorgId')
  async findOne(@Param('edorgId', new ParseIntPipe()) edorgId: number) {
    return toGetEdorgDto(await this.edorgService.findOne(+edorgId));
  }

  @Put(':edorgId')
  async update(
    @Param('edorgId', new ParseIntPipe()) edorgId: number,
    @Body() updateEdorgDto: PutEdorgDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetEdorgDto(
      await this.edorgService.update(
        edorgId,
        addUserModifying(updateEdorgDto, session.user)
      )
    );
  }

  @Delete(':edorgId')
  remove(
    @Param('edorgId', new ParseIntPipe()) edorgId: number,
    @ReqUser() session: GetSessionDataDto
  ) {
    return this.edorgService.remove(+edorgId, session.user);
  }
}
