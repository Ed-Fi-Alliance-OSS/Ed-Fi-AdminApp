import {
  GetSessionDataDto,
  PostOwnershipDto,
  PutOwnershipDto,
  toGetOwnershipDto,
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
import { OwnershipsService } from './ownerships.service';
import { ApiTags } from '@nestjs/swagger';
import { addUserCreating, addUserModifying } from '@edanalytics/models-server';

@ApiTags('Ownership')
@Controller()
export class OwnershipsController {
  constructor(private readonly ownershipService: OwnershipsService) {}

  @Post()
  async create(
    @Body() createOwnershipDto: PostOwnershipDto,
    @ReqUser() session: GetSessionDataDto,
    @Param('tenantId', new ParseIntPipe()) tenantId: number
  ) {
    return toGetOwnershipDto(
      await this.ownershipService.create(
        addUserCreating(createOwnershipDto, session.user)
      )
    );
  }

  @Get()
  async findAll(@Param('tenantId', new ParseIntPipe()) tenantId: number) {
    return toGetOwnershipDto(await this.ownershipService.findAll(tenantId));
  }

  @Get(':ownershipId')
  async findOne(
    @Param('ownershipId', new ParseIntPipe()) ownershipId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number
  ) {
    return toGetOwnershipDto(
      await this.ownershipService.findOne(tenantId, +ownershipId)
    );
  }

  @Put(':ownershipId')
  async update(
    @Param('ownershipId', new ParseIntPipe()) ownershipId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @Body() updateOwnershipDto: PutOwnershipDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetOwnershipDto(
      await this.ownershipService.update(
        tenantId,
        ownershipId,
        addUserModifying(updateOwnershipDto, session.user)
      )
    );
  }

  @Delete(':ownershipId')
  remove(
    @Param('ownershipId', new ParseIntPipe()) ownershipId: number,
    @Param('tenantId', new ParseIntPipe()) tenantId: number,
    @ReqUser() session: GetSessionDataDto
  ) {
    return this.ownershipService.remove(tenantId, +ownershipId, session.user);
  }
}
