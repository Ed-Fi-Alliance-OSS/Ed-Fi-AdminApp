import { Module } from '@nestjs/common';
import { UserTeamMembershipsController } from './user-team-memberships.controller';

@Module({
  controllers: [UserTeamMembershipsController],
})
export class UserTeamMembershipsModule {}
