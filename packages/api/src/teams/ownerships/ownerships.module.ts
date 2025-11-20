import { Module } from '@nestjs/common';
import { OwnershipsController } from './ownerships.controller';

@Module({
  controllers: [OwnershipsController],
})
export class OwnershipsModule {}
