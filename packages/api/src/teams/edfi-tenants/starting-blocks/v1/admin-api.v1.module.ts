import { Module } from '@nestjs/common';
import { AdminApiControllerV1 } from './admin-api.v1.controller';

@Module({
  controllers: [AdminApiControllerV1],
})
export class AdminApiModuleV1 {}
