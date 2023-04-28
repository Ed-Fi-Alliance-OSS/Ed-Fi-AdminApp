import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  ManyToMany,
  ViewColumn,
  ViewEntity,
} from 'typeorm';
import { ITenant } from '../interfaces/tenant.interface';
import { EntityBase } from '../utils/entity-base';
import { FakeMeUsing } from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import { UserTenantMembership } from './user-tenant-membership.entity';
import { IOwnership, IRole, IUserTenantMembership } from '../interfaces';

@Entity()
export class Tenant extends EntityBase implements ITenant {
  @Column()
  @FakeMeUsing(() => faker.address.county() + ' ' + faker.address.cityName())
  name: string;

  @OneToMany('UserTenantMembership', (userTenantMembership: IUserTenantMembership) => userTenantMembership.tenant)
  userTenantMemberships: IUserTenantMembership[];

  @OneToMany('Role', (role: IRole) => role.tenant)
  roles: IRole[];

  @OneToMany('Ownership', (ownership: IOwnership) => ownership.tenant)
  ownerships: IOwnership[];
}
