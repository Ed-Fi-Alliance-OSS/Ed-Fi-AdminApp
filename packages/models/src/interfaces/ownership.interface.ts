import { IEntityBase } from '../utils/entity-base.interface';

import { IEdfiTenant } from './edfi-tenant.interface';
import { IEdorg } from './edorg.interface';
import { IIntegrationProvider } from './integration-provider.interface';
import { IOds } from './ods.interface';
import { IRole } from './role.interface';
import { ISbEnvironment } from './sb-environment.interface';
import { ITeam } from './team.interface';

export interface IOwnership extends IEntityBase {
  team: ITeam;
  teamId: ITeam['id'];
  role: IRole | null;
  roleId: IRole['id'] | null;

  sbEnvironment?: ISbEnvironment;
  sbEnvironmentId?: number;

  edfiTenant?: IEdfiTenant;
  edfiTenantId?: number;

  ods?: IOds;
  odsId?: number;

  edorg?: IEdorg;
  edorgId?: number;

  integrationProvider?: IIntegrationProvider;
  integrationProviderId?: number;
}

export const OWNERSHIP_RESOURCE_TYPE = {
  edorg: 'edorg',
  ods: 'ods',
  edfiTenant: 'edfiTenant',
  sbEnvironment: 'sbEnvironment',
  integrationProvider: 'integrationProvider',
} as const;

export type OwnershipResourceType = keyof typeof OWNERSHIP_RESOURCE_TYPE;

export interface IOwnershipView {
  id: IOwnership['id'];
  teamId: ITeam['id'];
  roleId: IRole['id'] | null;
  resourceType: OwnershipResourceType;
  resourceText: string;
}
