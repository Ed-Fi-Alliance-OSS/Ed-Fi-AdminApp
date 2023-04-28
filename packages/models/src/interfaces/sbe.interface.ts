import { SbeMeta } from '../types/sbe-meta.type';
import { IEntityBase } from '../utils/entity-base.interface';
import { IEdorg } from './edorg.interface';
import { IOds } from './ods.interface';
import { IResource } from './resource.interface';

export interface ISbe extends IEntityBase {
  resource: IResource;
  resourceId: number;

  odss: IOds[];
  edorgs: IEdorg[];

  envLabel: string;
  meta: SbeMeta;
}
