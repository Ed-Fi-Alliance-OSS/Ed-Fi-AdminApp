import { Module } from '@nestjs/common';
import { IntegrationProvidersGlobalController } from './integration-providers-global.controller';

@Module({
  controllers: [IntegrationProvidersGlobalController],
})
export class IntegrationProvidersGlobalModule {}
