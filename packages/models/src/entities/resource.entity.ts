import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  ManyToMany,
  ViewColumn,
  ViewEntity,
  OneToOne,
} from 'typeorm';
import { IResource } from '../interfaces/resource.interface';
import { EntityBase } from '../utils/entity-base';
import { FakeMeUsing } from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import { ISbe } from '../interfaces/sbe.interface';
import { IOds } from '../interfaces/ods.interface';
import { IEdorg } from '../interfaces/edorg.interface';

@Entity()
export class Resource extends EntityBase implements IResource {
  @OneToOne('Sbe', (sbe: ISbe) => sbe.resource, { nullable: true, cascade: true })
  sbe?: ISbe

  @OneToOne('Ods', (ods: IOds) => ods.resource, { nullable: true, cascade: true })
  ods?: IOds

  @OneToOne('Edorg', (edorg: IEdorg) => edorg.resource, { nullable: true, cascade: true })
  edorg?: IEdorg

  get resource() {
    return this.edorg ?? this.ods ?? this.sbe
  }
}
