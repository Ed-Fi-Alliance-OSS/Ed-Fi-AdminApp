import { IOwnership, ISbEnvironment } from '.';
import { IEntityBase } from '../utils/entity-base.interface';
import { IEdorg } from './edorg.interface';
import { IOds } from './ods.interface';

export interface IEdfiTenant extends IEntityBase {
  ownerships: IOwnership[];

  sbEnvironment: ISbEnvironment;
  sbEnvironmentId: ISbEnvironment['id'];

  odss: IOds[];
  edorgs: IEdorg[];

  name: string;
}
