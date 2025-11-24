import { Module } from '@nestjs/common';
import { EdorgsGlobalController } from './edorgs-global.controller';

@Module({
  controllers: [EdorgsGlobalController],
})
export class EdorgsGlobalModule {}
