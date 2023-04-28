import { Module } from '@nestjs/common';
import { OdssService } from './odss.service';
import { OdssController } from './odss.controller';
import { Ods } from '@edanalytics/models';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Ods])],
  controllers: [OdssController],
  providers: [OdssService],
})
export class OdssModule {}
