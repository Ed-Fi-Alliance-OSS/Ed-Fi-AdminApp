import { Module } from '@nestjs/common';
import { EdfiTenantsController } from './edfi-tenants.controller';

@Module({
  controllers: [EdfiTenantsController],
})
export class EdfiTenantsModule {}
