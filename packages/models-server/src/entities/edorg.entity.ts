import { EdorgType, IEdorg, IOds, IOwnership, ISbe } from '@edanalytics/models';
import { FakeMeUsing, districtName, schoolType } from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  Tree,
  TreeChildren,
  TreeParent,
  Unique,
} from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
@FakeMeUsing(() =>
  Math.random() > 0.2
    ? {
        discriminator: EdorgType['edfi.School'],
        nameOfInstitution: `${faker.address.street()} ${schoolType()}`,
      }
    : {
        discriminator: EdorgType['edfi.LocalEducationAgency'],
        nameOfInstitution: districtName(),
      }
)
@Tree('closure-table')
@Unique(['sbeId', 'odsId', 'educationOrganizationId'])
export class Edorg extends EntityBase implements IEdorg {
  @OneToMany('Ownership', (ownership: IOwnership) => ownership.edorg)
  ownerships: IOwnership[];

  @ManyToOne('Ods', (ods: IOds) => ods.edorgs, { onDelete: 'CASCADE' })
  ods: IOds;

  @Column()
  odsId: number;

  @Column()
  odsDbName: string;

  @ManyToOne('Sbe', (sbe: ISbe) => sbe.edorgs, { onDelete: 'CASCADE' })
  sbe: ISbe;

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
  educationOrganizationId: number;

  @Column()
  nameOfInstitution: string;

  @Column({ nullable: true })
  shortNameOfInstitution: string | null;

  @Column({ type: 'varchar' })
  discriminator: EdorgType;

  get displayName() {
    return this.nameOfInstitution;
  }
}
