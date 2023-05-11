import { Expose, Type } from 'class-transformer';
import { EdorgType } from '../enums';
import { SbeConfigPrivate } from './sbe.dto';

export class SbMetaEdorg {
  @Expose()
  educationorganizationid: number;

  @Expose()
  nameofinstitution: string;

  @Expose()
  discriminator: EdorgType;

  @Expose()
  @Type(() => SbMetaEdorg)
  edorgs?: SbMetaEdorg[];
}

export class SbMetaOds {
  @Expose()
  dbname: string;

  @Expose()
  @Type(() => SbMetaEdorg)
  edorgs?: SbMetaEdorg[];
}

export class SbMetaEnv {
  @Expose()
  envlabel: string;

  @Expose()
  meta: SbeConfigPrivate;

  @Expose()
  @Type(() => SbMetaOds)
  odss?: SbMetaOds[];
}
