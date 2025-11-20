import { Module } from '@nestjs/common';
import { EdorgsController } from './edorgs.controller';

@Module({
  controllers: [EdorgsController],
})
export class EdorgsModule {}
