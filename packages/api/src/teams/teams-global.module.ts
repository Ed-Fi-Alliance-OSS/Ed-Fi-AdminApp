import { Module } from '@nestjs/common';
import { TeamsGlobalController } from './teams-global.controller';

@Module({
  controllers: [TeamsGlobalController],
})
export class TeamsGlobalModule {}
