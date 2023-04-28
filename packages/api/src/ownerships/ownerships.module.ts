import { Module } from '@nestjs/common';
import { OwnershipsService } from './ownerships.service';
import { OwnershipsController } from './ownerships.controller';
import { Ownership } from '@edanalytics/models';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Ownership])],
  controllers: [OwnershipsController],
  providers: [OwnershipsService],
})
export class OwnershipsModule {}
