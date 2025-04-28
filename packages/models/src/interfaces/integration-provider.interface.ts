import { IEntityBase } from '../utils/entity-base.interface';

export interface IIntegrationProvider extends IEntityBase {
  name: string;
  description: string;
}
