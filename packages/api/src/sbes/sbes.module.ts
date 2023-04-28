import { Module } from '@nestjs/common';
import { SbesService } from './sbes.service';
import { SbesController } from './sbes.controller';
import { Sbe } from '@edanalytics/models';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Sbe])],
  controllers: [SbesController],
  providers: [SbesService],
})
export class SbesModule {}
