import { Routes } from '@nestjs/core';
import { OwnershipsGlobalModule } from '../ownerships-global/ownerships-global.module';
import { RolesGlobalModule } from '../roles-global/roles-global.module';
import { EdorgsGlobalModule } from '../edfi-tenants-global/edorgs-global/edorgs-global.module';
import { OdssGlobalModule } from '../edfi-tenants-global/odss-global/odss-global.module';
import { EdfiTenantsGlobalModule } from '../edfi-tenants-global/edfi-tenants-global.module';
import { OwnershipsModule } from '../teams/ownerships/ownerships.module';
import { RolesModule } from '../teams/roles/roles.module';
import { EdorgsModule } from '../teams/edfi-tenants/edorgs/edorgs.module';
import { OdssModule } from '../teams/edfi-tenants/odss/odss.module';
import { EdfiTenantsModule } from '../teams/edfi-tenants/edfi-tenants.module';
import { AdminApiModuleV1 } from '../teams/edfi-tenants/starting-blocks/v1/admin-api.v1.module';
import { UserTeamMembershipsModule } from '../teams/user-team-memberships/user-team-memberships.module';
import { UsersModule } from '../teams/users/users.module';
import { UserTeamMembershipsGlobalModule } from '../user-team-memberships-global/user-team-memberships-global.module';
import { UsersGlobalModule } from '../users-global/users-global.module';
import { TeamsGlobalModule } from '../teams/teams-global.module';
import { SbSyncModule } from '../sb-sync/sb-sync.module';
import { AdminApiModuleV2 } from '../teams/edfi-tenants/starting-blocks/v2/admin-api.v2.module';
import { SbEnvironmentsGlobalModule } from '../sb-environments-global/sb-environments-global.module';
import { SbEnvironmentsModule } from '../teams/sb-environments/sb-environments.module';
import { IntegrationProvidersGlobalModule } from '../integration-providers-global/integration-providers-global.module';

export const routes: Routes = [
  {
    path: '/teams',
    module: TeamsGlobalModule,
    children: [
      {
        path: '/:teamId/sb-environments',
        module: SbEnvironmentsModule,
        children: [
          {
            path: '/:sbEnvironmentId/edfi-tenants',
            module: EdfiTenantsModule,
          },
        ],
      },
      {
        path: '/:teamId/users',
        module: UsersModule,
      },
      {
        path: '/:teamId/user-team-memberships',
        module: UserTeamMembershipsModule,
      },
      {
        path: '/:teamId/roles',
        module: RolesModule,
      },
      {
        path: '/:teamId/ownerships',
        module: OwnershipsModule,
      },
      {
        path: '/:teamId/edfi-tenants/:edfiTenantId/odss',
        module: OdssModule,
      },
      {
        path: '/:teamId/edfi-tenants/:edfiTenantId/edorgs',
        module: EdorgsModule,
      },
      {
        path: '/:teamId/edfi-tenants/:edfiTenantId/admin-api/v1',
        module: AdminApiModuleV1,
      },
      {
        path: '/:teamId/edfi-tenants/:edfiTenantId/admin-api/v2',
        module: AdminApiModuleV2,
      },
    ],
  },
  {
    path: '/sb-sync-queues',
    module: SbSyncModule,
  },
  {
    path: '/sb-environments',
    module: SbEnvironmentsGlobalModule,
    children: [
      {
        path: '/:sbEnvironmentId/edfi-tenants',
        module: EdfiTenantsGlobalModule,
      },
    ],
  },
  {
    path: '/edfi-tenants/:edfiTenantId/odss',
    module: OdssGlobalModule,
  },
  {
    path: '/edfi-tenants/:edfiTenantId/edorgs',
    module: EdorgsGlobalModule,
  },
  {
    path: '/integration-providers',
    module: IntegrationProvidersGlobalModule,
  },
  {
    path: '/ownerships',
    module: OwnershipsGlobalModule,
  },
  {
    path: '/roles',
    module: RolesGlobalModule,
  },
  {
    path: '/users',
    module: UsersGlobalModule,
  },
  {
    path: '/user-team-memberships',
    module: UserTeamMembershipsGlobalModule,
  },
];
