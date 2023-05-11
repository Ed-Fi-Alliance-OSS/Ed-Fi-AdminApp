import {
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
import { ReqUser } from '../auth/helpers/user.decorator';
import { OdssService } from './odss.service';
import { ApiTags } from '@nestjs/swagger';
import { addUserCreating, addUserModifying } from '@edanalytics/models-server';

@ApiTags('Ods')
@Controller()
export class OdssController {
  constructor(private readonly odsService: OdssService) {}

  @Post()
  async create(
    @Body() createOdsDto: PostOdsDto,
    @ReqUser() session: GetSessionDataDto,
    @Param('tenantId', new ParseIntPipe()) tenantId: number
  ) {
    return toGetOdsDto(
      await this.odsService.create(addUserCreating(createOdsDto, session.user))
    );
  }

  @Get()
  async findAll(@Param('tenantId', new ParseIntPipe()) tenantId: number) {
    return toGetOdsDto(await this.odsService.findAll(tenantId));
  }

  @Get(':odsId')
  async findOne(
    @Param('odsId', new ParseIntPipe()) odsId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number
  ) {
    return toGetOdsDto(await this.odsService.findOne(tenantId, +odsId));
  }

  @Put(':odsId')
  async update(
    @Param('odsId', new ParseIntPipe()) odsId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Body() updateOdsDto: PutOdsDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetOdsDto(
      await this.odsService.update(
        tenantId,
        odsId,
        addUserModifying(updateOdsDto, session.user)
      )
    );
  }

  @Delete(':odsId')
  remove(
    @Param('odsId', new ParseIntPipe()) odsId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqUser() session: GetSessionDataDto
  ) {
    return this.odsService.remove(tenantId, +odsId, session.user);
  }
}
