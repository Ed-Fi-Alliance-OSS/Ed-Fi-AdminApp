import { AddEdorgDtoV2, Ids, toGetEdorgDto } from '@edanalytics/models';
import { EdfiTenant, Edorg, Ods, SbEnvironment } from '@edanalytics/models-server';
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ReqEdfiTenant,
  ReqSbEnvironment,
  SbEnvironmentEdfiTenantInterceptor,
} from '../../../app/sb-environment-edfi-tenant.interceptor';
import {
  Authorize,
  CheckAbility,
  CheckAbilityType,
  Operation,
  SbVersion,
} from '../../../auth/authorization';
import { InjectFilter } from '../../../auth/helpers/inject-filter';
import { whereIds } from '../../../auth/helpers/where-ids';
import { ValidationHttpException } from '../../../utils';
import { EdorgsService } from './edorgs.service';

@ApiTags('Edorg')
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor)
@Controller()
export class EdorgsController {
  constructor(
    private readonly edorgService: EdorgsService,
    @InjectRepository(Edorg)
    private edorgsRepository: Repository<Edorg>,
    @InjectRepository(Ods) private odsRepository: Repository<Ods>
  ) {}

  @Get()
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg:read',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async findAll(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @InjectFilter('team.sb-environment.edfi-tenant.ods.edorg:read') validIds: Ids
  ) {
    return toGetEdorgDto(
      await this.edorgsRepository.findBy({ ...whereIds(validIds), edfiTenantId })
    );
  }

  @Get(':edorgId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg:read',
    subject: {
      id: 'edorgId',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async findOne(
    @Param('edorgId', new ParseIntPipe()) edorgId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number
  ) {
    return toGetEdorgDto(await this.edorgService.findOne(edorgId));
  }

  @Post()
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods:create-edorg',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async create(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @Body() dto: AddEdorgDtoV2,
    @CheckAbility() checkAbility: CheckAbilityType,
    @Req() request: any
  ) {
    const ods = await this.odsRepository.findOneBy({ edfiTenantId, odsInstanceName: dto.ODSName });
    if (ods === null) {
      throw new ValidationHttpException({
        field: 'ODSName',
        message: 'No ODS found by provided name',
      });
    }
    // artificially add odsId to request.params to be used by checkAbility
    request.params.odsId = String(ods.id);

    if (
      !checkAbility({
        privilege: 'team.sb-environment.edfi-tenant.ods:create-edorg',
        subject: {
          id: 'odsId',
          edfiTenantId: 'edfiTenantId',
          teamId: 'teamId',
        },
      })
    ) {
      throw new NotFoundException();
    }

    const allowedEdorgs =
      'tenants' in sbEnvironment.configPublic.values &&
      sbEnvironment.configPublic.values?.tenants?.[edfiTenant.name].allowedEdorgs;
    if (allowedEdorgs && !allowedEdorgs.includes(Number(dto.EdOrgId))) {
      throw new ValidationHttpException({
        field: 'EdOrgId',
        message: 'Unallowed ID given. Your allowed values are: ' + allowedEdorgs.join(', '),
      });
    }
    return this.edorgService.add(sbEnvironment, edfiTenant, dto);
  }

  @SbVersion('v2')
  @Operation('Deleting edorgs')
  @Delete(':edorgId')
  @Authorize({
    privilege: 'team.sb-environment.edfi-tenant.ods:delete-edorg',
    subject: {
      id: '__filtered__',
      edfiTenantId: 'edfiTenantId',
      teamId: 'teamId',
    },
  })
  async remove(
    @Param('edorgId', new ParseIntPipe()) edorgId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Param('edfiTenantId', new ParseIntPipe()) edfiTenantId: number,
    @ReqEdfiTenant() edfiTenant: EdfiTenant,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment,
    @CheckAbility() checkAbility: CheckAbilityType,
    @Req() request: any
  ) {
    if (
      // check for edorg read privilege which is required as a dependency of delete
      !checkAbility({
        privilege: 'team.sb-environment.edfi-tenant.ods.edorg:read',
        subject: {
          id: 'edorgId',
          edfiTenantId: 'edfiTenantId',
          teamId: 'teamId',
        },
      })
    ) {
      throw new NotFoundException();
    }

    const edorg = await this.edorgsRepository.findOne({
      where: { edfiTenantId, id: edorgId },
      relations: ['ods'],
    });
    if (edorg === null) {
      throw new NotFoundException();
    }
    const ods = edorg.ods;
    // artificially add odsId to request.params to be used by checkAbility
    request.params.odsId = String(ods.id);

    if (
      !checkAbility({
        privilege: 'team.sb-environment.edfi-tenant.ods:create-edorg',
        subject: {
          id: 'odsId',
          edfiTenantId: 'edfiTenantId',
          teamId: 'teamId',
        },
      })
    ) {
      throw new NotFoundException();
    }

    const allowedEdorgs =
      'tenants' in sbEnvironment.configPublic.values &&
      sbEnvironment.configPublic.values?.tenants?.[edfiTenant.name].allowedEdorgs;
    if (allowedEdorgs && !allowedEdorgs.includes(edorg.educationOrganizationId)) {
      throw new NotFoundException();
    }
    return this.edorgService.remove(
      sbEnvironment,
      edfiTenant,
      ods.odsInstanceName,
      String(edorg.educationOrganizationId)
    );
  }
}
