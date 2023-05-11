import { Module } from '@nestjs/common';
import { EdorgsService } from './edorgs.service';
import { EdorgsController } from './edorgs.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SbesService } from '../sbes/sbes.service';
import { OdssService } from '../odss/odss.service';
import { Edorg, Ownership, Sbe, Ods } from '@edanalytics/models-server';

@Module({
  imports: [TypeOrmModule.forFeature([Edorg, Ownership, Sbe, Ods])],
  controllers: [EdorgsController],
  providers: [EdorgsService, SbesService, OdssService],
})
export class EdorgsModule {}
