import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  ManyToMany,
  ViewColumn,
  ViewEntity,
  Tree,
  TreeChildren,
  TreeParent,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { IEdorg } from '../interfaces/edorg.interface';
import { EntityBase } from '../utils/entity-base';
import { FakeMeUsing, districtName, schoolType } from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import { IResource } from '../interfaces/resource.interface';
import { EdorgType } from '../enums/edorg-type.enum';
import { IOds } from '../interfaces/ods.interface';
import { ISbe } from '../interfaces';

@Entity()
@FakeMeUsing(() => Math.random() > 0.2 ? ({
  discriminator: EdorgType['edfi.School'],
  nameOfInstitution: `${faker.address.street()} ${schoolType()}`,
}) : ({
  discriminator: EdorgType['edfi.LocalEducationAgency'],
  nameOfInstitution: districtName(),
}))
@Tree("closure-table")
export class Edorg extends EntityBase implements IEdorg {
  @OneToOne('Resource', (resource: IResource) => resource.edorg)
  @JoinColumn()
  resource: IResource;
  @Column()
  resourceId: number;

  @ManyToOne('Ods', (ods: IOds) => ods.edorgs)
  ods: IOds
  @Column()
  odsId: number;

  @ManyToOne('Sbe', (sbe: ISbe) => sbe.edorgs)
  sbe: ISbe
  @Column()
  sbeId: number;

  @TreeChildren()
  children: IEdorg[];

  @TreeParent()
  parent?: IEdorg;

  @Column({ nullable: true })
  parentId?: number | undefined;

  @Column()
  @FakeMeUsing(() => faker.datatype.number(999999999))
  educationOrganizationId: string;

  @Column()
  nameOfInstitution: string;

  @Column({ type: 'varchar' })
  discriminator: EdorgType;
}
