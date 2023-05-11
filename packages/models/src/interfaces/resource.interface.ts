import { IEntityBase } from '../utils/entity-base.interface';
import { IEdorg } from './edorg.interface';
import { IOds } from './ods.interface';
import { IOwnership } from './ownership.interface';
import { ISbe } from './sbe.interface';

export interface IResource extends IEntityBase {
  sbe?: ISbe
  ods?: IOds
  edorg?: IEdorg
  ownerships: IOwnership[]
}
