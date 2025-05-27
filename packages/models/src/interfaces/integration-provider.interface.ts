import { IEntityBase } from '../utils/entity-base.interface';
import { IIntegrationApp } from './integration-app.interface';
import { IOwnership } from './ownership.interface';

export interface IIntegrationProvider extends IEntityBase {
  name: string;
  description: string;
  integrationApps: IIntegrationApp[];
  ownerships: IOwnership[];
}
