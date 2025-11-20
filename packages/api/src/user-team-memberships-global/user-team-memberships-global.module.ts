import { Module } from '@nestjs/common';
import { UserTeamMembershipsGlobalController } from './user-team-memberships-global.controller';

@Module({
  controllers: [UserTeamMembershipsGlobalController],
})
export class UserTeamMembershipsGlobalModule {}
