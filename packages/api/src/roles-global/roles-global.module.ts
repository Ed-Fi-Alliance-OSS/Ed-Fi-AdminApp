import { Module } from '@nestjs/common';
import { RolesGlobalController } from './roles-global.controller';

@Module({
  controllers: [RolesGlobalController],
})
export class RolesGlobalModule {}
