import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  ManyToMany,
  ViewColumn,
  ViewEntity,
  BeforeInsert,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { IOwnership } from '../interfaces/ownership.interface';
import { EntityBase } from '../utils/entity-base';
import {
  FakeMeUsing,
  deployEnv,
  schoolYear,
  districtName,
  schoolType,
} from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import { ITenant, IRole, IResource } from '../interfaces';

@Entity()
export class Ownership extends EntityBase implements IOwnership {
  @ManyToOne('Tenant', (tenant: ITenant) => tenant.ownerships)
  tenant: ITenant;
  @Column()
  tenantId: ITenant['id']

  @ManyToOne('Role', { nullable: true })
  role: IRole
  @Column({ nullable: true })
  roleId: IRole['id']

  @ManyToOne('Resource')
  resource: IResource;
  @Column()
  resourceId: number;
}
