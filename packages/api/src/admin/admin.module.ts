import { Edorg, Ods, Resource, Sbe } from '@edanalytics/models-server';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StartingBlocksServiceMock } from '../starting-blocks/starting-blocks.service.mock';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([Resource, Edorg, Ods, Sbe])],
  controllers: [AdminController],
  providers: [AdminService, StartingBlocksServiceMock],
})
export class AdminModule {}
