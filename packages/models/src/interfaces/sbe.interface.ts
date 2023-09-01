import { IOwnership } from '.';
import { IEntityBase } from '../utils/entity-base.interface';
import { IEdorg } from './edorg.interface';
import { IOds } from './ods.interface';

export interface ISbeConfigPublic {
  hasOdsRefresh?: false;
  edfiHostname?: string;
  lastSuccessfulConnectionSbMeta?: Date;
  lastFailedConnectionSbMeta?: Date;
  lastSuccessfulConnectionAdminApi?: Date;
  lastFailedConnectionAdminApi?: Date;
  lastSuccessfulPull?: Date;
  lastFailedPull?: Date;
  adminApiUrl?: string;
  adminApiKey?: string;
  adminApiClientDisplayName?: string;
  sbeMetaArn?: string;
  sbeMetaKey?: string;
}

export interface ISbeConfigPrivate {
  adminApiSecret: string;
  sbeMetaSecret: string;
}
export interface ISbe extends IEntityBase {
  ownerships: IOwnership[];

  odss: IOds[];
  edorgs: IEdorg[];

  envLabel: string | null;
  name: string;
  configPublic: ISbeConfigPublic | null;
  configPrivate: ISbeConfigPrivate | null;
}
