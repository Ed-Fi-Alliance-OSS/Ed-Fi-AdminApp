import { EdorgType, IEdorg, IOds, IResource, ISbe } from '@edanalytics/models';
import { FakeMeUsing, districtName, schoolType } from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  Tree,
  TreeChildren,
  TreeParent
} from 'typeorm';
import { EntityBase } from '../utils/entity-base';

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
