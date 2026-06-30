import { IIntegrationApp, IOwnership } from '.';
import { IEntityBase } from '../utils/entity-base.interface';
import { IEdorg } from './edorg.interface';
import { IEdfiTenant } from './edfi-tenant.interface';

export interface IOds extends IEntityBase {
  ownerships: IOwnership[];

  edfiTenant: IEdfiTenant;
  edfiTenantId: number;

  sbEnvironmentId: number;

  odsInstanceId: number | null;
  odsInstanceName: string | null;
  dbName: string;
  status: string | null;
  databaseTemplate: string | null;
  databaseName: string | null;
  edorgs: IEdorg[];

  integrationApps: IIntegrationApp[];
}
