import {
  IEdorg,
  IOds,
  IOwnership,
  ISbe,
  ISbeConfigPrivate,
  ISbeConfigPublic,
} from '@edanalytics/models';
import { Column, Entity, OneToMany } from 'typeorm';
import { JSONEncryptionTransformer } from 'typeorm-encrypted';
import { EntityBase } from '../utils/entity-base';

@Entity()
export class Sbe extends EntityBase implements ISbe {
  @OneToMany('Ownership', (ownership: IOwnership) => ownership.sbe)
  ownerships: IOwnership[];

  @OneToMany('Ods', (ods: IOds) => ods.sbe)
  odss: IOds[];
  @OneToMany('Edorg', (edorg: IEdorg) => edorg.sbe)
  edorgs: IEdorg[];

  @Column({ nullable: true })
  envLabel: string | null;

  @Column()
  name: string;

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
    return this.name ?? this.envLabel;
  }
}
