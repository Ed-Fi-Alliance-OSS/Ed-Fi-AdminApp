import { IEdorg, IOds, IOwnership, ISbe } from '@edanalytics/models';
import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
export class Ods extends EntityBase implements IOds {
  @OneToMany('Ownership', (ownership: IOwnership) => ownership.ods)
  ownerships: IOwnership[];

  @ManyToOne('Sbe', (sbe: ISbe) => sbe.odss, { onDelete: 'CASCADE' })
  sbe: ISbe;
  @Column()
  sbeId: number;

  @OneToMany('Edorg', (edorg: IEdorg) => edorg.ods)
  edorgs: IEdorg[];

  @Column()
  dbName: string;

  get displayName() {
    return this.dbName;
  }
}
