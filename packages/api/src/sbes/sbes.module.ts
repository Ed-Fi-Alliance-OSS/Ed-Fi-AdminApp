import { Module } from '@nestjs/common';
import { SbesService } from './sbes.service';
import { SbesController } from './sbes.controller';
import { Ownership, Sbe } from '@edanalytics/models-server';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Sbe, Ownership])],
  controllers: [SbesController],
  providers: [SbesService],
})
export class SbesModule {}
