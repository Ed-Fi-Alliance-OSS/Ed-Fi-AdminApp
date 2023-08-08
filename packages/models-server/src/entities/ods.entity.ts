import { IEdorg, IOds, IOwnership, ISbe } from '@edanalytics/models';
import { FakeMeUsing } from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
export class Ods extends EntityBase implements IOds {
  @OneToMany('Ownership', (ownership: IOwnership) => ownership.ods)
  ownerships: IOwnership[];

  @ManyToOne('Sbe', (sbe: ISbe) => sbe.odss)
  sbe: ISbe;
  @Column()
  sbeId: number;

  @OneToMany('Edorg', (edorg: IEdorg) => edorg.ods)
  edorgs: IEdorg[];

  @Column()
  @FakeMeUsing(() => `EdFi_Ods_${faker.datatype.number(999999999)}`)
  dbName: string;

  get displayName() {
    return this.dbName;
  }
}
