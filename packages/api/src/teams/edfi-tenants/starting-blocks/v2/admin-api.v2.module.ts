import { Module } from '@nestjs/common';
import { AdminApiControllerV2 } from './admin-api.v2.controller';

@Module({
  controllers: [AdminApiControllerV2],
})
export class AdminApiModuleV2 {}
