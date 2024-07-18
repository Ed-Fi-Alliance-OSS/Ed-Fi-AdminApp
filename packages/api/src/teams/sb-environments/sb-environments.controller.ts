import { Ids, toGetSbEnvironmentDto } from '@edanalytics/models';
import { SbEnvironment } from '@edanalytics/models-server';
import { Controller, Get, Param, ParseIntPipe, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Authorize, Operation, SbVersion } from '../../auth/authorization';
import { InjectFilter } from '../../auth/helpers/inject-filter';
import { whereIds } from '../../auth/helpers/where-ids';
import { throwNotFound } from '../../utils';
import { SbEnvironmentsService } from './sb-environments.service';
import {
  ReqSbEnvironment,
  SbEnvironmentEdfiTenantInterceptor,
} from '../../app/sb-environment-edfi-tenant.interceptor';

@ApiTags('SbEnvironment')
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor)
@Controller()
export class SbEnvironmentsController {
  constructor(
    private readonly sbEnvironmentService: SbEnvironmentsService,
    @InjectRepository(SbEnvironment)
    private sbEnvironmentsRepository: Repository<SbEnvironment>
  ) {}

  @Get()
  @Authorize({
    privilege: 'team.sb-environment:read',
    subject: {
      id: '__filtered__',
      teamId: 'teamId',
    },
  })
  async findAll(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @InjectFilter('team.sb-environment:read') validIds: Ids
  ) {
    return toGetSbEnvironmentDto(
      await this.sbEnvironmentsRepository.findBy({
        ...whereIds(validIds),
      })
    );
  }

  @Get(':sbEnvironmentId')
  @Authorize({
    privilege: 'team.sb-environment:read',
    subject: {
      id: 'sbEnvironmentId',
      teamId: 'teamId',
    },
  })
  async findOne(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Param('sbEnvironmentId', new ParseIntPipe())
    sbEnvironmentId: number
  ) {
    return toGetSbEnvironmentDto(
      await this.sbEnvironmentService.findOne(sbEnvironmentId).catch(throwNotFound)
    );
  }

  @SbVersion('v2')
  @Operation('Loading ODS templates')
  @Get(':sbEnvironmentId/ods-templates')
  @Authorize({
    privilege: 'team.sb-environment:read',
    subject: {
      id: 'sbEnvironmentId',
      teamId: 'teamId',
    },
  })
  findOdsTemplates(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Param('sbEnvironmentId', new ParseIntPipe())
    sbEnvironmentId: number,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment
  ) {
    return this.sbEnvironmentService.getOdsTemplates(sbEnvironment);
  }
}
