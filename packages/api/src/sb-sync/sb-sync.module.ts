import { SbSyncQueue, EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { Injectable, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import config from 'config';
import PgBoss from 'pg-boss';
import { AuthModule } from '../auth/auth.module';
import { AdminApiServiceV1 } from '../teams/edfi-tenants/starting-blocks/v1/admin-api.v1.service';
import { SbSyncController } from './sb-sync.controller';
import { SbSyncConsumer } from './sb-sync.consumer';
import {
  StartingBlocksServiceV1,
  StartingBlocksServiceV2,
} from '../teams/edfi-tenants/starting-blocks';
import { MetadataService } from '../teams/edfi-tenants/starting-blocks/metadata.service';

@Injectable()
export class PgBossInstance extends PgBoss {}

export const SYNC_SCHEDULER_CHNL = 'sbe-sync-scheduler';
export const ENV_SYNC_CHNL = 'sbe-sync';
export const TENANT_SYNC_CHNL = 'edfi-tenant-sync';

@Module({
  controllers: [SbSyncController],
})
export class SbSyncModule {}
