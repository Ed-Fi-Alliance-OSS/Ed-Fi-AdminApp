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
import { IRole } from '../interfaces/role.interface';
import { EntityBase } from '../utils/entity-base';
import {
  FakeMeUsing,
  deployEnv,
  schoolYear,
  districtName,
  schoolType,
} from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import { RoleType } from '../enums';
import { ITenant, IPrivilege } from '../interfaces';

@Entity()
export class Role extends EntityBase implements IRole {
  @Column()
  @FakeMeUsing(faker.commerce.department)
  name: string;

  @Column({ nullable: true })
  description?: string;

  @ManyToOne('Tenant', (tenant: ITenant) => tenant.roles, { nullable: true })
  tenant?: ITenant;

  @Column({ nullable: true })
  tenantId?: ITenant['id']

  @Column({ type: 'simple-json' })
  type: RoleType

  @ManyToMany('Privilege', { eager: true })
  @JoinTable()
  privileges: IPrivilege[];
}
