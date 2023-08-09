import { Edorg, Ods, Ownership, Sbe, User } from '@edanalytics/models-server';
import { Module } from '@nestjs/common';
import { APP_GUARD, RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import config from 'config';
import { AuthModule } from '../auth/auth.module';
import { AuthCacheGuard } from '../auth/authorization/authorization-cache.guard';
import { AuthorizedGuard } from '../auth/authorization/authorized.guard';
import { AuthenticatedGuard } from '../auth/login/authenticated.guard';
import typeormConfig from '../database/typeorm.config';
import { OwnershipsGlobalModule } from '../ownerships-global/ownerships-global.module';
import { PrivilegesModule } from '../privileges/privileges.module';
import { RolesGlobalModule } from '../roles-global/roles-global.module';
import { EdorgsGlobalModule } from '../sbes-global/edorgs-global/edorgs-global.module';
import { OdssGlobalModule } from '../sbes-global/odss-global/odss-global.module';
import { SbesGlobalModule } from '../sbes-global/sbes-global.module';
import { TenantsGlobalModule } from '../tenants/tenants-global.module';
import { OwnershipsModule } from '../tenants/ownerships/ownerships.module';
import { RolesModule } from '../tenants/roles/roles.module';
import { EdorgsModule } from '../tenants/sbes/edorgs/edorgs.module';
import { OdssModule } from '../tenants/sbes/odss/odss.module';
import { SbesModule } from '../tenants/sbes/sbes.module';
import { StartingBlocksModule } from '../tenants/sbes/starting-blocks/starting-blocks.module';
import { UserTenantMembershipsModule } from '../tenants/user-tenant-memberships/user-tenant-memberships.module';
import { UsersModule } from '../tenants/users/users.module';
import { UserTenantMembershipsGlobalModule } from '../user-tenant-memberships-global/user-tenant-memberships-global.module';
import { UsersGlobalModule } from '../users-global/users-global.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CacheModule } from './cache.module';
import { routes } from './routes';
import { SeedModule } from '../database/seed.module';

@Module({
  imports: [
    CacheModule,
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        return {
          ...typeormConfig,
          url: await config.DB_CONNECTION_STRING,
          logging: config.TYPEORM_LOGGING ? JSON.parse(config.TYPEORM_LOGGING) : undefined,
        };
      },
    }),
    SeedModule,
    TypeOrmModule.forFeature([User, Sbe, Ods, Edorg, Ownership]),
    RouterModule.register(routes),
    AuthModule,
    UsersModule,
    UserTenantMembershipsModule,
    OwnershipsModule,
    SbesModule,
    OdssModule,
    EdorgsModule,
    StartingBlocksModule,
    RolesModule,
    PrivilegesModule,
    SbesGlobalModule,
    OwnershipsGlobalModule,
    TenantsGlobalModule,
    UsersGlobalModule,
    UserTenantMembershipsGlobalModule,
    RolesGlobalModule,
    OdssGlobalModule,
    EdorgsGlobalModule,
  ],
  controllers: [AppController],
  providers: [
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
})
export class AppModule {}
