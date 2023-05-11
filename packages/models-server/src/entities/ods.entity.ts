import { IEdorg, IOds, IResource, ISbe } from '@edanalytics/models';
import { FakeMeUsing } from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne
} from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
export class Ods extends EntityBase implements IOds {
  @OneToOne('Resource', (resource: IResource) => resource.edorg)
  @JoinColumn()
  resource: IResource;
  @Column()
  resourceId: number;

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
