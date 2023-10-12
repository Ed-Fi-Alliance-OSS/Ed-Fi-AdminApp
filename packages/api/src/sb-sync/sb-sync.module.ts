import { SbSyncQueue, Sbe } from '@edanalytics/models-server';
import { Injectable, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SbSyncConsumer } from './sb-sync.consumer';

import config from 'config';
import PgBoss from 'pg-boss';
import { AuthModule } from '../auth/auth.module';
import {
  AdminApiService,
  StartingBlocksService,
} from '../tenants/sbes/starting-blocks/starting-blocks.service';
import { SbSyncController } from './sb-sync.controller';

@Injectable()
export class PgBossInstance extends PgBoss {}

export const SYNC_SCHEDULER_CHNL = 'sbe-sync-scheduler';
export const SYNC_CHNL = 'sbe-sync';

@Module({
  imports: [TypeOrmModule.forFeature([Sbe, SbSyncQueue]), AuthModule],
  controllers: [SbSyncController],
  providers: [
    SbSyncConsumer,
    AdminApiService,
    StartingBlocksService,
    {
      provide: 'PgBossInstance',
      useFactory: async () => {
        const boss = new PgBossInstance({
          connectionString: await config.DB_CONNECTION_STRING,
        });
        await boss.start();
        return boss;
      },
    },
  ],
  exports: [
    {
      provide: 'PgBossInstance',
      useExisting: 'PgBossInstance',
    },
  ],
})
export class SbSyncModule {}
