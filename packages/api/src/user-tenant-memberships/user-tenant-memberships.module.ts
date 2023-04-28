import { Module } from '@nestjs/common';
import { UserTenantMembershipsService } from './user-tenant-memberships.service';
import { UserTenantMembershipsController } from './user-tenant-memberships.controller';
import { UserTenantMembership } from '@edanalytics/models';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([UserTenantMembership])],
  controllers: [UserTenantMembershipsController],
  providers: [UserTenantMembershipsService],
})
export class UserTenantMembershipsModule {}
