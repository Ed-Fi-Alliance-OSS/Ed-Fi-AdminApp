import { IEdorg, IOds, IOwnership, IResource, ISbe } from '@edanalytics/models';
import { Entity, OneToMany, OneToOne } from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
export class Resource extends EntityBase implements IResource {
  @OneToOne('Sbe', (sbe: ISbe) => sbe.resource, {
    nullable: true,
    cascade: true,
    eager: true,
  })
  sbe?: ISbe;

  @OneToOne('Ods', (ods: IOds) => ods.resource, {
    nullable: true,
    cascade: true,
    eager: true,
  })
  ods?: IOds;

  @OneToOne('Edorg', (edorg: IEdorg) => edorg.resource, {
    nullable: true,
    cascade: true,
    eager: true,
  })
  edorg?: IEdorg;

  get resource() {
    return this.edorg ?? this.ods ?? this.sbe;
  }

  @OneToMany('Ownership', (ownership: IOwnership) => ownership.resource, {
    cascade: true,
  })
  ownerships: IOwnership[];
}
