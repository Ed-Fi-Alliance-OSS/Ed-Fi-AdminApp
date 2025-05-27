import { IEntityBase } from '../utils/entity-base.interface';
import { IEdfiTenant } from './edfi-tenant.interface';
import { IIntegrationProvider } from './integration-provider.interface';
import { IOds } from './ods.interface';
import { ISbEnvironment } from './sb-environment.interface';

export interface IIntegrationApp extends IEntityBase {
  applicationId: number | null;
  applicationName: string;
  edfiTenant: IEdfiTenant;
  edfiTenantId: number;
  edorgIds: number[];
  integrationProvider: IIntegrationProvider;
  integrationProviderId: number; // This is the only editable field
  ods: IOds;
  odsId: number;
  sbEnvironment: ISbEnvironment;
  sbEnvironmentId: number;
}

export interface IIntegrationAppDetailed extends IIntegrationApp {
  edfiTenantName: string;
  edorgNames: string[];
  odsName: string;
  sbEnvironmentName: string;
}
