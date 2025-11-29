import { isSbV2MetaEnv } from '@edanalytics/models';
import { EdfiTenant, SbEnvironment, regarding } from '@edanalytics/models-server';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import config from 'config';
import PgBoss from 'pg-boss';
import { Repository } from 'typeorm';
import {
  StartingBlocksServiceV1,
  StartingBlocksServiceV2,
} from '../teams/edfi-tenants/starting-blocks';
import { MetadataService } from '../teams/edfi-tenants/starting-blocks/metadata.service';
import { CustomHttpException } from '../utils/customExceptions';
import {
  ENV_SYNC_CHNL,
  PgBossInstance,
  SYNC_SCHEDULER_CHNL,
  TENANT_SYNC_CHNL,
} from './sb-sync.module';

@Injectable()
export class SbSyncConsumer implements OnModuleInit {
  constructor(
    @InjectRepository(SbEnvironment)
    private sbEnvironmentsRepository: Repository<SbEnvironment>,
    @InjectRepository(EdfiTenant)
    private edfiTenantsRepository: Repository<EdfiTenant>,
    @Inject('PgBossInstance')
    private readonly boss: PgBossInstance,
    private readonly sbServiceV1: StartingBlocksServiceV1,
    private readonly sbServiceV2: StartingBlocksServiceV2,
    private readonly metadataService: MetadataService
  ) {}
  public async onModuleDestroy() {
    if (config.DB_ENGINE === 'mssql') {
      // mssql is not yet supported
      return null;
    }
    await this.boss.stop();
  }
  public async onModuleInit() {
    if (config.DB_ENGINE === 'mssql') {
      // mssql is not yet supported
      return null;
    }
    this.boss.on('error', (error) => Logger.error(error));

    try {
      await this.boss.schedule(SYNC_SCHEDULER_CHNL, config.SB_SYNC_CRON, null, {
        tz: 'America/Chicago',
      });
      Logger.log('Sync scheduler job scheduled successfully');
    } catch (error) {
      if ((error as Error & { status?: number })?.status === 503) {
        Logger.warn(
          'Database unavailable - sync scheduler will be set up when database becomes available'
        );
      } else {
        Logger.error('Failed to schedule sync job:', error);
        throw error;
      }
    }

    try {
      await this.boss.work(SYNC_SCHEDULER_CHNL, async () => {
        const sbEnvironments = await this.sbEnvironmentsRepository
          .createQueryBuilder()
          .select()
          .where(`"configPublic"->>'sbEnvironmentMetaArn' is not null`)
          .getMany();

        Logger.log(`Starting sync for ${sbEnvironments.length} environments.`);
        await Promise.all(
          sbEnvironments.map((sbEnvironment) =>
            this.boss.send(
              ENV_SYNC_CHNL,
              { sbEnvironmentId: sbEnvironment.id },
              { singletonKey: String(sbEnvironment.id), expireInHours: 1 }
            )
          )
        );
      });

      await this.boss.work(ENV_SYNC_CHNL, async (job: PgBoss.Job<{ sbEnvironmentId: number }>) => {
        return this.refreshSbEnvironment(job.data.sbEnvironmentId);
      });

      await this.boss.work(TENANT_SYNC_CHNL, async (job: PgBoss.Job<{ edfiTenantId: number }>) => {
        return this.refreshEdfiTenant(job.data.edfiTenantId);
      });

      Logger.log('Sync workers registered successfully');
    } catch (error) {
      if ((error as Error & { status?: number })?.status === 503) {
        Logger.warn(
          'Database unavailable - sync workers will be registered when database becomes available'
        );
      } else {
        Logger.error('Failed to register sync workers:', error);
        throw error;
      }
    }
  }

  async refreshSbEnvironment(sbEnvironmentId: number) {
    let sbEnvironment = await this.sbEnvironmentsRepository
      .createQueryBuilder()
      .select()
      .where(`"configPublic"->>'sbEnvironmentMetaArn' is not null and id = :id`, {
        id: sbEnvironmentId,
      })
      .getOne();
    if (sbEnvironment === null) {
      //try to find a syncable environment EdFi
      sbEnvironment = await this.sbEnvironmentsRepository
        .createQueryBuilder()
        .select()
        .where(`"configPublic"->>'type' is not null and id = :id`, {
          id: sbEnvironmentId,
        })
        .getOne();
      if (sbEnvironment === null)
        throw new NotFoundException(`No syncable environment found with id ${sbEnvironmentId}`);

      // make some stuff to the environment like getting the tenants. Tenants are getting from a lambda function
      // maybe we should have a list of tenants in the sbEnvironment react form?
    } else {
      // Use the lambda function to get metadata
      const sbMeta = await this.metadataService.getMetadata(sbEnvironment);
      if (sbMeta.status === 'NO_CONFIG') {
        throw new CustomHttpException(
          {
            type: 'Error',
            title: 'Metadata retrieval failed.',
            message: 'Bad config for metadata lambda function.',
            regarding: regarding(sbEnvironment),
          },
          500
        );
      } else if (sbMeta.status !== 'SUCCESS') {
        throw new CustomHttpException(
          {
            type: 'Error',
            title: 'Matadata retrieval failed.',
            message: sbMeta.error,
            regarding: regarding(sbEnvironment),
          },
          500
        );
      }
      let result: Awaited<
        ReturnType<
          | StartingBlocksServiceV1['syncEnvironmentEverything']
          | StartingBlocksServiceV2['syncEnvironmentEverything']
        >
      >;
      if (isSbV2MetaEnv(sbMeta.data)) {
        result = await this.sbServiceV2.syncEnvironmentEverything(sbEnvironment, sbMeta.data);
      } else {
        result = await this.sbServiceV1.syncEnvironmentEverything(sbEnvironment, sbMeta.data);
      }
      if (result.status !== 'SUCCESS') {
        throw result;
      } else {
        return result.data;
      }
    }
  }

  async refreshEdfiTenant(edfiTenantId: number) {
    const edfiTenant = await this.edfiTenantsRepository.findOne({
      where: {
        id: edfiTenantId,
      },
      relations: ['sbEnvironment'],
    });
    const sbEnvironment = edfiTenant.sbEnvironment;
    const sbMeta = await this.metadataService.getMetadata(sbEnvironment);
    if (sbMeta.status === 'NO_CONFIG') {
      throw new CustomHttpException(
        {
          type: 'Error',
          title: 'Metadata retrieval failed.',
          message: 'Bad config for metadata lambda function.',
          regarding: regarding(sbEnvironment),
        },
        500
      );
    } else if (sbMeta.status !== 'SUCCESS') {
      throw new CustomHttpException(
        {
          type: 'Error',
          title: 'Matadata retrieval failed.',
          message: sbMeta.error,
          regarding: regarding(sbEnvironment),
        },
        500
      );
    }
    let result: Awaited<
      ReturnType<
        | StartingBlocksServiceV1['syncTenantResourceTree']
        | StartingBlocksServiceV2['syncTenantResourceTree']
      >
    >;
    if (isSbV2MetaEnv(sbMeta.data)) {
      result = await this.sbServiceV2.syncTenantResourceTree(edfiTenant);
    } else {
      result = await this.sbServiceV1.syncTenantResourceTree(edfiTenant, sbMeta.data);
    }
    if (result.status !== 'SUCCESS') {
      throw result;
    } else {
      return result.data;
    }
  }
}
