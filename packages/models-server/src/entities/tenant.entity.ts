import { IOwnership, IRole, ITenant, IUserTenantMembership } from '@edanalytics/models';
import { FakeMeUsing } from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import {
  Column,
  Entity,
  OneToMany
} from 'typeorm';
import { EntityBase } from '../utils/entity-base';

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
