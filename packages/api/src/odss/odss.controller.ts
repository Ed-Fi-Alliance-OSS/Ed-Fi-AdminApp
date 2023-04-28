import {
  addUserCreating,
  addUserModifying,
  GetSessionDataDto,
  PostOdsDto,
  PutOdsDto,
  toGetOdsDto,
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
import { OdssService } from './odss.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('ODS')
@Controller()
export class OdssController {
  constructor(private readonly odsService: OdssService) { }

  @Post()
  async create(
    @Body() createOdsDto: PostOdsDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetOdsDto(
      await this.odsService.create(addUserCreating(createOdsDto, session.user))
    );
  }

  @Get()
  async findAll(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
  ) {
    return toGetOdsDto(await this.odsService.findAll(sbeId));
  }

  @Get(':odsId')
  async findOne(@Param('odsId', new ParseIntPipe()) odsId: number) {
    return toGetOdsDto(await this.odsService.findOne(+odsId));
  }

  @Put(':odsId')
  async update(
    @Param('odsId', new ParseIntPipe()) odsId: number,
    @Body() updateOdsDto: PutOdsDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetOdsDto(
      await this.odsService.update(
        odsId,
        addUserModifying(updateOdsDto, session.user)
      )
    );
  }

  @Delete(':odsId')
  remove(
    @Param('odsId', new ParseIntPipe()) odsId: number,
    @ReqUser() session: GetSessionDataDto
  ) {
    return this.odsService.remove(+odsId, session.user);
  }
}
