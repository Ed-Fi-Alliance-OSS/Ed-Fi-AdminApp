import {
  IEdorg,
  IOds,
  IOwnership,
  ISbe,
  ISbeConfigPrivate,
  ISbeConfigPublic,
} from '@edanalytics/models';
import { FakeMeUsing, deployEnv, schoolYear } from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import { Column, Entity, OneToMany } from 'typeorm';
import { EntityBase } from '../utils/entity-base';
import { JSONEncryptionTransformer } from 'typeorm-encrypted';

@Entity()
export class Sbe extends EntityBase implements ISbe {
  @OneToMany('Ownership', (ownership: IOwnership) => ownership.sbe)
  ownerships: IOwnership[];

  @OneToMany('Ods', (ods: IOds) => ods.sbe)
  odss: IOds[];
  @OneToMany('Edorg', (edorg: IEdorg) => edorg.sbe)
  edorgs: IEdorg[];

  @Column()
  envLabel: string;

  @Column({ type: 'jsonb', nullable: true })
  configPublic: ISbeConfigPublic | null;

  @Column({
    type: 'jsonb',
    nullable: true,
    transformer: {
      from(value) {
        if ('DB_SECRETS_ENCRYPTION' in global) {
          return new JSONEncryptionTransformer({
            key: DB_SECRETS_ENCRYPTION.KEY,
            algorithm: 'aes-256-cbc',
            iv: DB_SECRETS_ENCRYPTION.IV,
            ivLength: 16,
          }).from(value);
        } else {
          throw new Error('DB_SECRETS_ENCRYPTION not defined');
        }
      },
      to(value) {
        if ('DB_SECRETS_ENCRYPTION' in global) {
          return new JSONEncryptionTransformer({
            key: DB_SECRETS_ENCRYPTION.KEY,
            algorithm: 'aes-256-cbc',
            iv: DB_SECRETS_ENCRYPTION.IV,
            ivLength: 16,
          }).to(value);
        } else {
          throw new Error('DB_SECRETS_ENCRYPTION not defined');
        }
      },
    },
  })
  configPrivate: ISbeConfigPrivate | null;

  get displayName() {
    return this.envLabel;
  }
}
