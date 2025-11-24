import { Module } from '@nestjs/common';
import { IntegrationAppsTeamController } from './integration-apps-team.controller';

@Module({
  controllers: [IntegrationAppsTeamController],
})
export class IntegrationAppsTeamModule {}
