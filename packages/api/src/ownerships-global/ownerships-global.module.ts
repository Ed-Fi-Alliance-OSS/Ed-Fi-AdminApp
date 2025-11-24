import { Module } from '@nestjs/common';
import { OwnershipsGlobalController } from './ownerships-global.controller';

@Module({
  controllers: [OwnershipsGlobalController],
})
export class OwnershipsGlobalModule {}
