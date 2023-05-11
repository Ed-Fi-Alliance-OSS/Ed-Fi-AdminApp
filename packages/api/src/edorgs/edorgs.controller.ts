import {
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
import { ReqUser } from '../auth/helpers/user.decorator';
import { EdorgsService } from './edorgs.service';
import { ApiTags } from '@nestjs/swagger';
import { addUserCreating, addUserModifying } from '@edanalytics/models-server';

@ApiTags('Edorg')
@Controller()
export class EdorgsController {
  constructor(private readonly edorgService: EdorgsService) {}

  @Post()
  async create(
    @Body() createEdorgDto: PostEdorgDto,
    @ReqUser() session: GetSessionDataDto,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Param('sbeId', new ParseIntPipe()) sbeId: number
  ) {
    return toGetEdorgDto(
      await this.edorgService.create(
        addUserCreating(createEdorgDto, session.user)
      )
    );
  }

  @Get()
  async findAll(
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Param('sbeId', new ParseIntPipe()) sbeId: number
  ) {
    return toGetEdorgDto(await this.edorgService.findAll(tenantId, sbeId));
  }

  @Get(':edorgId')
  async findOne(
    @Param('edorgId', new ParseIntPipe()) edorgId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Param('sbeId', new ParseIntPipe()) sbeId: number
  ) {
    return toGetEdorgDto(
      await this.edorgService.findOne(tenantId, sbeId, +edorgId)
    );
  }

  @Put(':edorgId')
  async update(
    @Param('edorgId', new ParseIntPipe()) edorgId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Body() updateEdorgDto: PutEdorgDto,
    @ReqUser() session: GetSessionDataDto,
    @Param('sbeId', new ParseIntPipe()) sbeId: number
  ) {
    return toGetEdorgDto(
      await this.edorgService.update(
        tenantId,
        sbeId,
        edorgId,
        addUserModifying(updateEdorgDto, session.user)
      )
    );
  }

  @Delete(':edorgId')
  remove(
    @Param('edorgId', new ParseIntPipe()) edorgId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqUser() session: GetSessionDataDto,
    @Param('sbeId', new ParseIntPipe()) sbeId: number
  ) {
    return this.edorgService.remove(tenantId, sbeId, +edorgId, session.user);
  }
}
