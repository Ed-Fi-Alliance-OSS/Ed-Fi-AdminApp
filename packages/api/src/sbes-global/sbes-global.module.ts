import {
  Edorg,
  Ods,
  Ownership,
  SbSyncQueue,
  Sbe,
  User,
  UserTenantMembership,
} from '@edanalytics/models-server';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from '../auth/auth.service';
import { SbSyncModule } from '../sb-sync/sb-sync.module';
import { SbesService } from '../tenants/sbes/sbes.service';
import { StartingBlocksService } from '../tenants/sbes/starting-blocks/starting-blocks.service';
import { SbesGlobalController } from './sbes-global.controller';
import { SbesGlobalService } from './sbes-global.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Edorg, Ods, Sbe, Ownership, User, UserTenantMembership, SbSyncQueue]),
    SbSyncModule,
  ],
  controllers: [SbesGlobalController],
  providers: [SbesGlobalService, StartingBlocksService, SbesService, AuthService],
  exports: [SbesGlobalService],
})
export class SbesGlobalModule {}
