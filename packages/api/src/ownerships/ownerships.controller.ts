import {
  addUserCreating,
  addUserModifying,
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
import { ReqUser } from '../auth/user.decorator';
import { OwnershipsService } from './ownerships.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Ownership')
@Controller()
export class OwnershipsController {
  constructor(private readonly ownershipService: OwnershipsService) {}

  @Post()
  async create(
    @Body() createOwnershipDto: PostOwnershipDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetOwnershipDto(
      await this.ownershipService.create(
        addUserCreating(createOwnershipDto, session.user)
      )
    );
  }

  @Get()
  async findAll() {
    return toGetOwnershipDto(await this.ownershipService.findAll());
  }

  @Get(':ownershipId')
  async findOne(@Param('ownershipId', new ParseIntPipe()) ownershipId: number) {
    return toGetOwnershipDto(await this.ownershipService.findOne(+ownershipId));
  }

  @Put(':ownershipId')
  async update(
    @Param('ownershipId', new ParseIntPipe()) ownershipId: number,
    @Body() updateOwnershipDto: PutOwnershipDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetOwnershipDto(
      await this.ownershipService.update(
        ownershipId,
        addUserModifying(updateOwnershipDto, session.user)
      )
    );
  }

  @Delete(':ownershipId')
  remove(
    @Param('ownershipId', new ParseIntPipe()) ownershipId: number,
    @ReqUser() session: GetSessionDataDto
  ) {
    return this.ownershipService.remove(+ownershipId, session.user);
  }
}
