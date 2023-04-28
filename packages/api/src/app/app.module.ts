import { OwnershipsModule } from '../ownerships/ownerships.module';
import { RolesModule } from '../roles/roles.module';
import { PrivilegesModule } from '../privileges/privileges.module';
import { UserTenantMembershipsModule } from '../user-tenant-memberships/user-tenant-memberships.module';
import { Module } from '@nestjs/common';
import { APP_GUARD, RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import typeormConfig from '../database/typeorm.config';
import { EdorgsModule } from '../edorgs/edorgs.module';
import { OdssModule } from '../odss/odss.module';
import { ResourcesModule } from '../resources/resources.module';
import { SbesModule } from '../sbes/sbes.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { routes } from './routes';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeormConfig),
    RouterModule.register(routes),
    UsersModule,
    AuthModule,
    TenantsModule,
    ResourcesModule,
    OdssModule,
    EdorgsModule,
    SbesModule,
    UserTenantMembershipsModule,
    PrivilegesModule,
    RolesModule,
    OwnershipsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthenticatedGuard,
    },
  ],
})
export class AppModule {}
