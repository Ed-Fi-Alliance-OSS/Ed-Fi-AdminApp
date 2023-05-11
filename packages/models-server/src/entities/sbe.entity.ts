import { IEdorg, IOds, IResource, ISbe, ISbeConfigPrivate, ISbeConfigPublic } from '@edanalytics/models';
import { FakeMeUsing, deployEnv, schoolYear } from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne
} from 'typeorm';
import { JSONEncryptionTransformer } from 'typeorm-encrypted';
import { EntityBase } from '../utils/entity-base';

@Entity()
export class Sbe extends EntityBase implements ISbe {
  @OneToOne('Resource', (resource: IResource) => resource.sbe)
  @JoinColumn()
  resource: IResource;
  @Column()
  resourceId: number;

  @OneToMany('Ods', (ods: IOds) => ods.sbe)
  odss: IOds[];
  @OneToMany('Edorg', (edorg: IEdorg) => edorg.sbe)
  edorgs: IEdorg[];

  @Column()
  @FakeMeUsing(() => `${deployEnv()}-${schoolYear()}-${faker.random.alpha(5)}`)
  envLabel: string;
  @Column({ type: 'simple-json' })
  @FakeMeUsing({ hasOdsRefresh: false })
  configPublic: ISbeConfigPublic;

  @FakeMeUsing(() => ({
    adminApiUrl: '<adminApiUrl>',
    adminApiKey: '<adminApiKey>',
    adminApiSecret: '<adminApiSecret>',
    sbeMetaUrl: '<sbeMetaUrl>',
    awsLambdaKey: '<awsLambdaKey>',
    awsLambdaSecret: '<awsLambdaSecret>',
  }))
  @Column({
    type: 'simple-json',
    nullable: false,
    transformer: new JSONEncryptionTransformer({
      key: DB_SECRETS_ENCRYPTION.DB_SECRETS_ENCRYPTION_KEY,
      algorithm: "aes-256-cbc",
      iv: DB_SECRETS_ENCRYPTION.DB_SECRETS_ENCRYPTION_IV,
      ivLength: 16,
    })
  })
  configPrivate: ISbeConfigPrivate;
}

