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
import { IOds } from '../interfaces/ods.interface';
import { EntityBase } from '../utils/entity-base';
import { FakeMeUsing } from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import { IResource } from '../interfaces/resource.interface';
import { IEdorg } from '../interfaces/edorg.interface';
import { ISbe } from '../interfaces/sbe.interface';

@Entity()
export class Ods extends EntityBase implements IOds {
  @OneToOne('Resource', (resource: IResource) => resource.edorg)
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


  @ManyToOne('Sbe', (sbe: ISbe) => sbe.odss)
  sbe: ISbe;
  @Column()
  sbeId: number;

  @OneToMany('Edorg', (edorg: IEdorg) => edorg.ods)
  edorgs: IEdorg[];

  @Column()
  @FakeMeUsing(() => `EdFi_Ods_${faker.datatype.number(999999999)}`)
  dbName: string;
}
