import { EdorgType } from '../enums/edorg-type.enum';
import { IEntityBase } from '../utils/entity-base.interface';
import { IOds } from './ods.interface';
import { IResource } from './resource.interface';
import { ISbe } from './sbe.interface';

export interface IEdorg extends IEntityBase {
  resource: IResource;
  resourceId: number;

  sbe: ISbe;
  sbeId: number;
  ods: IOds;
  odsId: number;

  children: IEdorg[];
  parent?: IEdorg;
  parentId?: number;

  educationOrganizationId: string;
  nameOfInstitution: string;
  discriminator: EdorgType;

}
