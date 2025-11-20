import { Module } from '@nestjs/common';
import { EdfiTenantsGlobalController } from './edfi-tenants-global.controller';

@Module({
  controllers: [EdfiTenantsGlobalController],
})
export class EdfiTenantsGlobalModule {}
