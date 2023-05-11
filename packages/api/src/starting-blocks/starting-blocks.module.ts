import { Edorg, Ods, Sbe } from '@edanalytics/models-server';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StartingBlocksController } from './starting-blocks.controller';
import { StartingBlocksServiceMock } from './starting-blocks.service.mock';

@Module({
  imports: [TypeOrmModule.forFeature([Sbe, Ods, Edorg])],
  controllers: [StartingBlocksController],
  providers: [StartingBlocksServiceMock],
})
export class StartingBlocksModule {}
