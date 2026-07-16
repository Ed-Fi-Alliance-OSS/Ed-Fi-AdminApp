import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SbEnvironment, SbSyncQueue } from '@edanalytics/models-server';
import { SbV3MetaEnv } from '@edanalytics/models';
import { randomUUID } from 'crypto';
import { AdminApiServiceV3 } from '../teams/edfi-tenants/starting-blocks';
import { IJobQueueService } from '../sb-sync/job-queue/job-queue.interface';
import { V2AdminApiVersionStrategy } from './v2-admin-api-version.strategy';
import { BuildConfigPublicInput } from './admin-api-version-strategy.interface';

@Injectable()
export class V3AdminApiVersionStrategy extends V2AdminApiVersionStrategy {
  readonly version: 'v1' | 'v2' | 'v3' = 'v3';

  constructor(
    private readonly adminApiServiceV3: AdminApiServiceV3,
    @Inject('IJobQueueService')
    jobQueue: IJobQueueService,
    @InjectRepository(SbSyncQueue)
    queueRepository: Repository<SbSyncQueue>,
    @InjectRepository(SbEnvironment)
    sbEnvironmentsRepository: Repository<SbEnvironment>
  ) {
    // V2's constructor takes AdminApiServiceV2; V3 never uses `this.adminApiServiceV2`
    // because getAdminApiService() is overridden below, so passing `undefined` is safe.
    super(undefined as never, jobQueue, queueRepository, sbEnvironmentsRepository);
  }

  getAdminApiService() {
    return this.adminApiServiceV3 as any;
  }

  buildConfigPublic({ createSbEnvironmentDto, odsApiMetaResponse, tenantMode }: BuildConfigPublicInput) {
    return {
      startingBlocks: createSbEnvironmentDto.startingBlocks,
      odsApiMeta: odsApiMetaResponse,
      adminApiUrl: createSbEnvironmentDto.adminApiUrl,
      version: 'v3' as const,
      values: {
        meta: {
          envlabel: createSbEnvironmentDto.environmentLabel,
          mode: tenantMode,
          domainName: createSbEnvironmentDto.odsApiDiscoveryUrl,
          adminApiUrl: createSbEnvironmentDto.adminApiUrl,
          tenantManagementFunctionArn: '',
          tenantResourceTreeFunctionArn: '',
          odsManagementFunctionArn: '',
          edorgManagementFunctionArn: '',
          dataFreshnessFunctionArn: '',
        } satisfies SbV3MetaEnv,
        adminApiUuid: randomUUID(),
      },
    } as any;
  }
}
