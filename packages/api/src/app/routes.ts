import { Routes } from '@nestjs/core';
import { EdorgsModule } from '../edorgs/edorgs.module';
import { OdssModule } from '../odss/odss.module';
import { OwnershipsModule } from '../ownerships/ownerships.module';
import { PrivilegesModule } from '../privileges/privileges.module';
import { ResourcesModule } from '../resources/resources.module';
import { RolesModule } from '../roles/roles.module';
import { SbesModule } from '../sbes/sbes.module';
import { StartingBlocksModule } from '../starting-blocks/starting-blocks.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UserTenantMembershipsModule } from '../user-tenant-memberships/user-tenant-memberships.module';
import { UsersModule } from '../users/users.module';
import { AdminModule } from '../admin/admin.module';

export const routes: Routes = [
  {
    path: 'tenants',
    module: TenantsModule,
    children: [
      {
        path: ':tenantId/sbes',
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
          {
            path: '/:sbeId',
            module: StartingBlocksModule,
          },
        ],
      },
      {
        path: ':tenantId/users',
        module: UsersModule,
      },
      {
        path: ':tenantId/user-tenant-memberships',
        module: UserTenantMembershipsModule,
      },
      {
        path: ':tenantId/roles',
        module: RolesModule,
      },
      {
        path: ':tenantId/ownerships',
        module: OwnershipsModule,
      },
    ],
  },
  {
    path: 'resources',
    module: ResourcesModule,
  },
  {
    path: 'privileges',
    module: PrivilegesModule,
  },
  {
    path: 'admin',
    module: AdminModule,
  },
];
