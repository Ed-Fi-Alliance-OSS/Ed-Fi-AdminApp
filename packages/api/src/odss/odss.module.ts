import { Module } from '@nestjs/common';
import { OdssService } from './odss.service';
import { OdssController } from './odss.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SbesService } from '../sbes/sbes.service';
import { Ods, Ownership, Sbe } from '@edanalytics/models-server';

@Module({
  imports: [TypeOrmModule.forFeature([Ods, Ownership, Sbe])],
  controllers: [OdssController],
  providers: [OdssService, SbesService],
})
export class OdssModule {}
