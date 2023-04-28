import { Module } from '@nestjs/common';
import { EdorgsService } from './edorgs.service';
import { EdorgsController } from './edorgs.controller';
import { Edorg } from '@edanalytics/models';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Edorg])],
  controllers: [EdorgsController],
  providers: [EdorgsService],
})
export class EdorgsModule {}
