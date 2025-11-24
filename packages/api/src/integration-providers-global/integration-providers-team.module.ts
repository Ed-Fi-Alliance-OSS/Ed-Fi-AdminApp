import { Module } from '@nestjs/common';
import { IntegrationProvidersTeamController } from './integration-providers-team.controller';

@Module({
  controllers: [IntegrationProvidersTeamController],
})
export class IntegrationProvidersTeamModule {}
