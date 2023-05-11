import { IEntityBase } from '../utils/entity-base.interface';
import { IEdorg } from './edorg.interface';
import { IOds } from './ods.interface';
import { IResource } from './resource.interface';

export interface ISbeConfigPublic {
  hasOdsRefresh: false;
}

export interface ISbeConfigPrivate {
  adminApiUrl: string;
  adminApiKey: string;
  adminApiSecret: string;

  sbeMetaUrl: string;
  sbeMetaKey: string;
  sbeMetaSecret: string;
}
export interface ISbe extends IEntityBase {
  resource: IResource;
  resourceId: number;

  odss: IOds[];
  edorgs: IEdorg[];

  envLabel: string;
  configPublic: ISbeConfigPublic;
  configPrivate: ISbeConfigPrivate;
}
