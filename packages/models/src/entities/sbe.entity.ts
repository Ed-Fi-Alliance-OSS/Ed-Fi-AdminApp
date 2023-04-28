import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  ManyToMany,
  ViewColumn,
  ViewEntity,
  OneToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { ISbe } from '../interfaces/sbe.interface';
import { EntityBase } from '../utils/entity-base';
import { FakeMeUsing, deployEnv, schoolYear } from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import { IResource } from '../interfaces/resource.interface';
import { IOds } from '../interfaces/ods.interface';
import { SbeMeta } from '../types';
import { IEdorg } from '../interfaces';

@Entity()
export class Sbe extends EntityBase implements ISbe {
  @OneToOne('Resource', (resource: IResource) => resource.sbe)
  @JoinColumn()
  resource: IResource;
  @Column()
  resourceId: number;

  @BeforeInsert()
  setResource() {
    if (
      this.resource === undefined ||
      (
        (this.resource.createdById === undefined || this.resource.createdById === null) &&
        (this.resource.createdBy === undefined || this.resource.createdBy === null)
      )
    ) {
      this.resource = {
        createdById: this.createdById,
        createdBy: this.createdBy,
        created: this.created,
        id: this?.resource?.id,
      }
    } else {
      console.log('nothing');

    }
  }

  @OneToMany('Ods', (ods: IOds) => ods.sbe)
  odss: IOds[];
  @OneToMany('Edorg', (edorg: IEdorg) => edorg.sbe)
  edorgs: IEdorg[];

  @Column()
  @FakeMeUsing(() => `${deployEnv()}-${schoolYear()}-${faker.random.alpha(5)}`)
  envLabel: string;
  @Column({ type: 'simple-json' })
  @FakeMeUsing({ adminApiUrl: 'https://www.example.com' })
  meta: SbeMeta;
}
