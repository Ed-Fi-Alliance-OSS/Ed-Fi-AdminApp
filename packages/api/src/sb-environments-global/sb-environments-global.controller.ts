import { validate } from '@aws-sdk/util-arn-parser';
import {
  GetSessionDataDto,
  Id,
  PgBossJobState,
  PostSbEnvironmentDto,
  PutSbEnvironmentDto,
  PutSbEnvironmentMeta,
  toGetSbEnvironmentDto,
  toOperationResultDto,
  toPostSbEnvironmentResponseDto,
  toSbSyncQueueDto,
} from '@edanalytics/models';
import {
  SbEnvironment,
  SbSyncQueue,
  addUserCreating,
  addUserModifying,
} from '@edanalytics/models-server';

import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ReqSbEnvironment,
  SbEnvironmentEdfiTenantInterceptor,
} from '../app/sb-environment-edfi-tenant.interceptor';
import { Authorize } from '../auth/authorization';
import { ReqUser } from '../auth/helpers/user.decorator';
import { ENV_SYNC_CHNL, PgBossInstance } from '../sb-sync/sb-sync.module';
import { CustomHttpException, ValidationHttpException, throwNotFound } from '../utils';
import { SbEnvironmentsGlobalService } from './sb-environments-global.service';
import { StartingBlocksServiceV2 } from '../teams/edfi-tenants/starting-blocks';
import { Operation, SbVersion } from '../auth/authorization/sbVersion.decorator';
import { SbEnvironmentsEdFiService } from './sb-environments-edfi.services';

@ApiTags('SbEnvironment - Global')
@UseInterceptors(SbEnvironmentEdfiTenantInterceptor)
@Controller()
export class SbEnvironmentsGlobalController {
  constructor(
    private readonly sbEnvironmentService: SbEnvironmentsGlobalService,
    private readonly sbEnvironmentEdFiService: SbEnvironmentsEdFiService,
    @InjectRepository(SbEnvironment)
    private sbEnvironmentsRepository: Repository<SbEnvironment>,
    private startingBlocksServiceV2: StartingBlocksServiceV2,
    @Inject('PgBossInstance')
    private readonly boss: PgBossInstance,
    @InjectRepository(SbSyncQueue) private readonly queueRepository: Repository<SbSyncQueue>
  ) {}

  @Post()
  @Authorize({
    privilege: 'sb-environment:create',
    subject: {
      id: '__filtered__',
    },
  })
  async create(
    @Body() createSbEnvironmentDto: PostSbEnvironmentDto,
    @ReqUser() user: GetSessionDataDto
  ) {
    if (createSbEnvironmentDto.metaArn) {
      if (!validate(createSbEnvironmentDto.metaArn)) {
        throw new ValidationHttpException({
          field: 'metaArn',
          message: 'Invalid ARN. This field is optional.',
        });
      }
      const sbEnvironment = await this.sbEnvironmentsRepository.save(
        addUserCreating(
          this.sbEnvironmentsRepository.create({
            name: createSbEnvironmentDto.name,
            configPublic: {
              startingBlocks: createSbEnvironmentDto.startingBlocks,
              sbEnvironmentMetaArn: createSbEnvironmentDto.metaArn,
            },
          }),
          user
        )
      );
      const id = await this.boss.send(
        ENV_SYNC_CHNL,
        { sbEnvironmentId: sbEnvironment.id },
        { expireInHours: 2 }
      );
      const repo = this.queueRepository;
      return new Promise((r) => {
        let queueItem: SbSyncQueue;
        const timer = setInterval(poll, 500);
        const pendingState: PgBossJobState[] = ['created', 'retry', 'active'];
        let i = 0;
        async function poll() {
          queueItem = await repo.findOneBy({ id });
          if (i === 20 || !pendingState.includes(queueItem.state)) {
            clearInterval(timer);
            r(
              toPostSbEnvironmentResponseDto({
                id: sbEnvironment.id,
                syncQueue: toSbSyncQueueDto(queueItem),
              })
            );
          }
          i++;
        }
      });
    } else {
      const response = await this.sbEnvironmentEdFiService.create(createSbEnvironmentDto, user);
      return toPostSbEnvironmentResponseDto(response);
    }
  }

  @Get()
  @Authorize({
    privilege: 'sb-environment:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findAll() {
    return toGetSbEnvironmentDto(await this.sbEnvironmentsRepository.find());
  }

  @Get(':sbEnvironmentId')
  @Authorize({
    privilege: 'sb-environment:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findOne(
    @Param('sbEnvironmentId', new ParseIntPipe())
    sbEnvironmentId: number
  ) {
    return toGetSbEnvironmentDto(
      await this.sbEnvironmentService.findOne(sbEnvironmentId).catch(throwNotFound)
    );
  }

  @Put(':sbEnvironmentId')
  @Authorize({
    privilege: 'sb-environment:update',
    subject: {
      id: '__filtered__',
    },
  })
  async update(
    @Param('sbEnvironmentId', new ParseIntPipe())
    sbEnvironmentId: number,
    @Body() updateSbEnvironmentDto: PutSbEnvironmentDto,
    @ReqUser() user: GetSessionDataDto
  ) {
    return toGetSbEnvironmentDto(
      await this.sbEnvironmentService.update(
        sbEnvironmentId,
        addUserModifying(updateSbEnvironmentDto, user)
      )
    );
  }

  @Delete(':sbEnvironmentId')
  @Authorize({
    privilege: 'sb-environment:delete',
    subject: {
      id: '__filtered__',
    },
  })
  remove(
    @Param('sbEnvironmentId', new ParseIntPipe())
    sbEnvironmentId: number,
    @ReqUser() user: GetSessionDataDto
  ) {
    return this.sbEnvironmentService.remove(sbEnvironmentId, user);
  }
  @Put(':sbEnvironmentId/meta-arn')
  @Authorize({
    privilege: 'sb-environment.edfi-tenant:update',
    subject: {
      id: '__filtered__',
    },
  })
  async updateSbMeta(
    @Param('sbEnvironmentId', new ParseIntPipe()) sbEnvironmentId: number,
    @Body() updateDto: PutSbEnvironmentMeta,
    @ReqUser() user: GetSessionDataDto
  ) {
    return toGetSbEnvironmentDto(
      await this.sbEnvironmentService.updateMetadataArn(
        sbEnvironmentId,
        addUserModifying(updateDto, user)
      )
    );
  }

  @SbVersion('v2')
  @Operation('Reloading tenants')
  @Put(':sbEnvironmentId/reload-tenants')
  @Authorize({
    privilege: 'sb-environment.edfi-tenant:update',
    subject: {
      id: '__filtered__',
    },
  })
  async reloadTenants(
    @Param('sbEnvironmentId', new ParseIntPipe()) sbEnvironmentId: number,
    @Body() updateDto: Id,
    @ReqUser() user: GetSessionDataDto,
    @ReqSbEnvironment() sbEnvironment: SbEnvironment
  ) {
    const result = await this.startingBlocksServiceV2.tenantMgmtService.reload(sbEnvironment);
    if (result.status !== 'SUCCESS') {
      throw new CustomHttpException(
        {
          title: 'Failed to reload tenants in Starting Blocks',
          type: 'Error',
          message: result.status,
        },
        500
      );
    }
    return toOperationResultDto({
      title: 'Reload triggered successfully',
      message: typeof result?.data === 'string' ? result.data : undefined,
      type: 'Success',
    });
  }
  @Put(':sbEnvironmentId/refresh-resources')
  @Authorize({
    privilege: 'sb-environment:refresh-resources',
    subject: {
      id: 'sbEnvironmentId',
    },
  })
  async refreshResources(@Param('sbEnvironmentId', new ParseIntPipe()) sbEnvironmentId: number) {
    const id = await this.boss.send(
      ENV_SYNC_CHNL,
      { sbEnvironmentId: sbEnvironmentId },
      { expireInHours: 2 }
    );
    const repo = this.queueRepository;
    return new Promise((r) => {
      let queueItem: SbSyncQueue;
      const timer = setInterval(poll, 500);
      const pendingState: PgBossJobState[] = ['created', 'retry', 'active'];
      let i = 0;
      async function poll() {
        queueItem = await repo.findOneBy({ id });
        if (i === 20 || !pendingState.includes(queueItem.state)) {
          clearInterval(timer);
          r(toSbSyncQueueDto(queueItem));
        }
        i++;
      }
    });
  }
}
