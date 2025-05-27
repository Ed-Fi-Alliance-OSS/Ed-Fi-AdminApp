import { Global, Module } from '@nestjs/common';
import { SbEnvironmentsService } from '../teams/sb-environments/sb-environments.service';
import { UserTeamMembershipsService } from '../teams/user-team-memberships/user-team-memberships.service';
import { UsersService } from '../teams/users/users.service';
import { UserTeamMembershipsGlobalService } from '../user-team-memberships-global/user-team-memberships-global.service';
import { UsersGlobalService } from '../users-global/users-global.service';
import {
  EdfiTenant,
  Edorg,
  EnvNav,
  IntegrationApp,
  IntegrationAppDetailed,
  IntegrationProvider,
  Ods,
  Oidc,
  Ownership,
  OwnershipView,
  Role,
  SbEnvironment,
  SbSyncQueue,
  Team,
  User,
  UserTeamMembership,
} from '@edanalytics/models-server';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from '../auth/auth.service';
import { SessionSerializer } from '../auth/helpers/session.serializer';
import { RegisterOidcIdpsService } from '../auth/login/oidc.strategy';
import { EdorgsGlobalService } from '../edfi-tenants-global/edorgs-global/edorgs-global.service';
import { OdssGlobalService } from '../edfi-tenants-global/odss-global/odss-global.service';
import { OwnershipsGlobalService } from '../ownerships-global/ownerships-global.service';
import { RolesGlobalService } from '../roles-global/roles-global.service';
import { SbEnvironmentsGlobalService } from '../sb-environments-global/sb-environments-global.service';
import { SbSyncConsumer } from '../sb-sync/sb-sync.consumer';
import { EdfiTenantsService } from '../teams/edfi-tenants/edfi-tenants.service';
import { EdorgsService } from '../teams/edfi-tenants/edorgs/edorgs.service';
import { OdssService } from '../teams/edfi-tenants/odss/odss.service';
import {
  AdminApiServiceV1,
  StartingBlocksServiceV2,
  StartingBlocksServiceV1,
  AdminApiServiceV2,
} from '../teams/edfi-tenants/starting-blocks';
import { MetadataService } from '../teams/edfi-tenants/starting-blocks/metadata.service';
import { OwnershipsService } from '../teams/ownerships/ownerships.service';
import { RolesService } from '../teams/roles/roles.service';
import { TeamsGlobalService } from '../teams/teams-global.service';
import { CacheService } from './cache.module';
import { Auth0Service } from '../auth0/auth0.service';
import { IntegrationAppsTeamService } from '../integration-apps-team/integration-apps-team.service';

const imports = [
  TypeOrmModule.forFeature([
    EdfiTenant,
    Edorg,
    EnvNav,
    IntegrationApp,
    IntegrationAppDetailed,
    IntegrationProvider,
    Ods,
    Oidc,
    Ownership,
    OwnershipView,
    Role,
    SbEnvironment,
    SbSyncQueue,
    Team,
    User,
    UserTeamMembership,
  ]),
];

const providers = [
  AdminApiServiceV1,
  AdminApiServiceV2,
  AuthService,
  Auth0Service,
  CacheService,
  EdfiTenantsService,
  EdorgsGlobalService,
  EdorgsService,
  IntegrationAppsTeamService,
  MetadataService,
  OdssGlobalService,
  OdssService,
  OwnershipsGlobalService,
  OwnershipsService,
  RegisterOidcIdpsService,
  RolesGlobalService,
  RolesService,
  SbEnvironmentsGlobalService,
  SbEnvironmentsService,
  SbSyncConsumer,
  SessionSerializer,
  StartingBlocksServiceV1,
  StartingBlocksServiceV2,
  TeamsGlobalService,
  UserTeamMembershipsGlobalService,
  UserTeamMembershipsService,
  UsersGlobalService,
  UsersService,
];

@Global()
@Module({
  imports: imports,
  providers: providers,
  exports: [...providers, ...imports],
})
export class ServicesModule {}
