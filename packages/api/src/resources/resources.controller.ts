import {
  addUserCreating,
  addUserModifying,
  GetSessionDataDto,
  PostResourceDto,
  PutResourceDto,
  toGetResourceDto,
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
import { ResourcesService } from './resources.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Resource')
@Controller()
export class ResourcesController {
  constructor(private readonly resourceService: ResourcesService) {}

  @Post()
  async create(
    @Body() createResourceDto: PostResourceDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetResourceDto(
      await this.resourceService.create(
        addUserCreating(createResourceDto, session.user)
      )
    );
  }

  @Get()
  async findAll() {
    return toGetResourceDto(await this.resourceService.findAll());
  }

  @Get(':resourceId')
  async findOne(@Param('resourceId', new ParseIntPipe()) resourceId: number) {
    return toGetResourceDto(await this.resourceService.findOne(+resourceId));
  }

  @Put(':resourceId')
  async update(
    @Param('resourceId', new ParseIntPipe()) resourceId: number,
    @Body() updateResourceDto: PutResourceDto,
    @ReqUser() session: GetSessionDataDto
  ) {
    return toGetResourceDto(
      await this.resourceService.update(
        resourceId,
        addUserModifying(updateResourceDto, session.user)
      )
    );
  }

  @Delete(':resourceId')
  remove(
    @Param('resourceId', new ParseIntPipe()) resourceId: number,
    @ReqUser() session: GetSessionDataDto
  ) {
    return this.resourceService.remove(+resourceId, session.user);
  }
}
