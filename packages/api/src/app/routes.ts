import { OwnershipsModule } from '../ownerships/ownerships.module';
import { RolesModule } from '../roles/roles.module';
import { PrivilegesModule } from '../privileges/privileges.module';
import { UserTenantMembershipsModule } from '../user-tenant-memberships/user-tenant-memberships.module';
import { Routes } from '@nestjs/core';
import { TenantsModule } from '../tenants/tenants.module';
import { SbesModule } from '../sbes/sbes.module';
import { OdssModule } from '../odss/odss.module';
import { EdorgsModule } from '../edorgs/edorgs.module';
import { UsersModule } from '../users/users.module';
import { ResourcesModule } from '../resources/resources.module';

export const routes: Routes = [
  {
    path: 'tenants',
    module: TenantsModule,
  },
  {
    path: 'resources',
    module: ResourcesModule,
  },
  {
    path: 'users',
    module: UsersModule,
  },
  {
    path: 'sbes',
    module: SbesModule,
    children: [
      {
        path: '/:sbeId/odss',
        module: OdssModule,
      },
      {
        path: '/:sbeId/edorgs',
        module: EdorgsModule,
      },
    ],
  },
  {
    path: 'user-tenant-memberships',
    module: UserTenantMembershipsModule,
  },
  {
    path: 'privileges',
    module: PrivilegesModule,
  },
  {
    path: 'roles',
    module: RolesModule,
  },
  {
    path: 'ownerships',
    module: OwnershipsModule,
  },
];
