import { EdorgType } from '../enums';

export interface SbV1MetaEdorg {
  educationorganizationid: number;
  nameofinstitution: string;
  shortnameofinstitution: string;
  discriminator: EdorgType;
  edorgs?: SbV1MetaEdorg[];
}
export interface SbV1MetaOds {
  dbname: string;
  edorgs?: SbV1MetaEdorg[];
}
export interface SbV1MetaEnv {
  envlabel: string;
  mode: string;
  domainName: string;
  odss?: SbV1MetaOds[];
}
