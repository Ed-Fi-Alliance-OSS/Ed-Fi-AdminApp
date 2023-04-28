import { IEntityBase } from '../utils/entity-base.interface';
import { IEdorg } from './edorg.interface';
import { IResource } from './resource.interface';
import { ISbe } from './sbe.interface';

export interface IOds extends IEntityBase {
  resource: IResource;
  resourceId: number;

  sbe: ISbe;
  sbeId: number;

  dbName: string;
  edorgs: IEdorg[];
}
