import { Module } from '@nestjs/common';
import { APP_GUARD, RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import config from 'config';
import { AuthModule } from '../auth/auth.module';
import { AuthCacheGuard } from '../auth/authorization/authorization-cache.guard';
import { AuthorizedGuard } from '../auth/authorization/authorized.guard';
import { AuthenticatedGuard } from '../auth/login/authenticated.guard';
import typeormConfig from '../database/typeorm.config';
import { EdfiTenantsGlobalModule } from '../edfi-tenants-global/edfi-tenants-global.module';
import { EdorgsGlobalModule } from '../edfi-tenants-global/edorgs-global/edorgs-global.module';
import { OdssGlobalModule } from '../edfi-tenants-global/odss-global/odss-global.module';
import { OwnershipsGlobalModule } from '../ownerships-global/ownerships-global.module';
import { RolesGlobalModule } from '../roles-global/roles-global.module';
import { SbEnvironmentsGlobalModule } from '../sb-environments-global/sb-environments-global.module';
import { SbSyncModule } from '../sb-sync/sb-sync.module';
import { EdfiTenantsModule } from '../teams/edfi-tenants/edfi-tenants.module';
import { EdorgsModule } from '../teams/edfi-tenants/edorgs/edorgs.module';
import { OdssModule } from '../teams/edfi-tenants/odss/odss.module';
import { AdminApiModuleV1 } from '../teams/edfi-tenants/starting-blocks/v1/admin-api.v1.module';
import { AdminApiModuleV2 } from '../teams/edfi-tenants/starting-blocks/v2/admin-api.v2.module';
import { OwnershipsModule } from '../teams/ownerships/ownerships.module';
import { RolesModule } from '../teams/roles/roles.module';
import { SbEnvironmentsModule } from '../teams/sb-environments/sb-environments.module';
import { TeamsGlobalModule } from '../teams/teams-global.module';
import { UserTeamMembershipsModule } from '../teams/user-team-memberships/user-team-memberships.module';
import { UsersModule } from '../teams/users/users.module';
import { UserTeamMembershipsGlobalModule } from '../user-team-memberships-global/user-team-memberships-global.module';
import { UsersGlobalModule } from '../users-global/users-global.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { routes } from './routes';
import { SbEnvironmentEdfiTenantInterceptor } from './sb-environment-edfi-tenant.interceptor';
import { ServicesModule } from './services.module';
import { PgBossModule } from '../sb-sync/pg-boss.module';
import { IntegrationProvidersGlobalModule } from '../integration-providers-global/integration-providers-global.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        return {
          ...typeormConfig,
          url: await config.DB_CONNECTION_STRING,
          logging: config.TYPEORM_LOGGING ? JSON.parse(config.TYPEORM_LOGGING) : undefined,
        };
      },
    }),
    RouterModule.register(routes),
    PgBossModule,
    ServicesModule,
    AuthModule,
    UsersModule,
    UserTeamMembershipsModule,
    OwnershipsModule,
    EdfiTenantsModule,
    OdssModule,
    EdorgsModule,
    AdminApiModuleV1,
    AdminApiModuleV2,
    RolesModule,
    EdfiTenantsGlobalModule,
    SbEnvironmentsGlobalModule,
    SbEnvironmentsModule,
    OwnershipsGlobalModule,
    TeamsGlobalModule,
    UsersGlobalModule,
    UserTeamMembershipsGlobalModule,
    RolesGlobalModule,
    OdssGlobalModule,
    EdorgsGlobalModule,
    SbSyncModule,
    IntegrationProvidersGlobalModule,
  ],
  controllers: [AppController],
  providers: [
    SbEnvironmentEdfiTenantInterceptor,
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthenticatedGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthCacheGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthorizedGuard,
    },
  ],
  exports: [SbEnvironmentEdfiTenantInterceptor],
})
export class AppModule {}
