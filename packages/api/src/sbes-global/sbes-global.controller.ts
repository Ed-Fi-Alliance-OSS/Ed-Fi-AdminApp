import {
  GetSessionDataDto,
  PostSbeDto,
  PutSbeAdminApi,
  PutSbeAdminApiRegister,
  PutSbeMeta,
  toGetSbeDto,
  toOperationResultDto,
} from '@edanalytics/models';
import { Sbe, addUserCreating, addUserModifying, regarding } from '@edanalytics/models-server';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Response,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Authorize } from '../auth/authorization';
import { ReqUser } from '../auth/helpers/user.decorator';
import { StartingBlocksService } from '../tenants/sbes/starting-blocks/starting-blocks.service';
import { throwNotFound } from '../utils';
import { SbesGlobalService } from './sbes-global.service';
import { ValidationError } from 'class-validator';
import { StatusType, OperationResult, formErrFromValidator } from '@edanalytics/utils';
import { ValidationException, WorkflowFailureException } from '../utils/customExceptions';
import { Response as Res } from 'express';

@ApiTags('Sbe - Global')
@Controller()
export class SbesGlobalController {
  constructor(
    private readonly sbeService: SbesGlobalService,
    @InjectRepository(Sbe)
    private sbesRepository: Repository<Sbe>,
    private readonly sbService: StartingBlocksService
  ) {}

  @Post()
  @Authorize({
    privilege: 'sbe:create',
    subject: {
      id: '__filtered__',
    },
  })
  async create(@Body() createSbeDto: PostSbeDto, @ReqUser() user: GetSessionDataDto) {
    return toGetSbeDto(await this.sbeService.create(addUserCreating(createSbeDto, user)));
  }

  @Get()
  @Authorize({
    privilege: 'sbe:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findAll() {
    return toGetSbeDto(await this.sbesRepository.find());
  }

  @Get(':sbeId')
  @Authorize({
    privilege: 'sbe:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findOne(@Param('sbeId', new ParseIntPipe()) sbeId: number) {
    return toGetSbeDto(await this.sbeService.findOne(sbeId).catch(throwNotFound));
  }

  @Put(':sbeId/refresh-resources')
  @Authorize({
    privilege: 'sbe:refresh-resources',
    subject: {
      id: '__filtered__',
    },
  })
  async refreshResources(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @ReqUser() user: GetSessionDataDto
  ) {
    return toOperationResultDto(await this.sbeService.refreshResources(sbeId, user));
  }

  @Put(':sbeId/check-admin-api')
  @Authorize({
    privilege: 'sbe:read',
    subject: {
      id: '__filtered__',
    },
  })
  async checkAdminAPI(@Param('sbeId', new ParseIntPipe()) sbeId: number) {
    return toOperationResultDto(await this.sbeService.checkAdminAPI(sbeId));
  }
  @Put(':sbeId/check-sb-meta')
  @Authorize({
    privilege: 'sbe:read',
    subject: {
      id: '__filtered__',
    },
  })
  async checkSbMeta(@Param('sbeId', new ParseIntPipe()) sbeId: number) {
    return toOperationResultDto(await this.sbeService.checkSbMeta(sbeId));
  }

  @Put(':sbeId/admin-api')
  @Authorize({
    privilege: 'sbe:update',
    subject: {
      id: '__filtered__',
    },
  })
  async updateAdminApi(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Body() updateDto: PutSbeAdminApi,
    @ReqUser() user: GetSessionDataDto
  ) {
    return toGetSbeDto(
      await this.sbeService.updateAdminApi(sbeId, addUserModifying(updateDto, user))
    );
  }
  @Put(':sbeId/sbe-meta')
  @Authorize({
    privilege: 'sbe:update',
    subject: {
      id: '__filtered__',
    },
  })
  async updateSbMeta(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Body() updateDto: PutSbeMeta,
    @ReqUser() user: GetSessionDataDto
  ) {
    return toGetSbeDto(
      await this.sbeService.updateSbMeta(sbeId, addUserModifying(updateDto, user))
    );
  }

  @Put(':sbeId/register-admin-api')
  @Authorize({
    privilege: 'sbe:update',
    subject: {
      id: '__filtered__',
    },
  })
  async registerAdminApi(
    @Param('sbeId', new ParseIntPipe()) sbeId: number,
    @Body() updateDto: PutSbeAdminApiRegister,
    @ReqUser() user: GetSessionDataDto
  ) {
    const sbe = await this.sbeService.findOne(sbeId).catch(throwNotFound);
    const result = await this.sbeService.selfRegisterAdminApi(
      sbe,
      addUserModifying(updateDto, user)
    );
    if (result.status === 'ENOTFOUND') {
      const err = new ValidationError();
      err.property = 'adminRegisterUrl';
      err.constraints = {
        server: 'DNS lookup failed for URL provided.',
      };
      err.value = false;
      throw new ValidationException(formErrFromValidator([err]));
    } else if (result.status === 'ERROR') {
      throw new WorkflowFailureException({
        status: StatusType.warning,
        title: 'Self-registration failed.',
        message: 'I like to eat several pounds of cheese per fortnight.',
        regarding: regarding(sbe),
      });
    } else if (result.status === 'SUCCESS') {
      return toGetSbeDto(result.result);
    }
  }

  @Delete(':sbeId')
  @Authorize({
    privilege: 'sbe:delete',
    subject: {
      id: '__filtered__',
    },
  })
  remove(@Param('sbeId', new ParseIntPipe()) sbeId: number, @ReqUser() user: GetSessionDataDto) {
    return this.sbeService.remove(sbeId, user);
  }
}
