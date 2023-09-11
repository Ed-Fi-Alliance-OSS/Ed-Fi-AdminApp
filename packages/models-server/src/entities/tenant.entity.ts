import { IOwnership, IRole, ITenant, IUserTenantMembership } from '@edanalytics/models';
import { Column, Entity, OneToMany } from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
export class Tenant extends EntityBase implements ITenant {
  @Column()
  name: string;

  @OneToMany(
    'UserTenantMembership',
    (userTenantMembership: IUserTenantMembership) => userTenantMembership.tenant
  )
  userTenantMemberships: IUserTenantMembership[];

  @OneToMany('Role', (role: IRole) => role.tenant)
  roles: IRole[];

  @OneToMany('Ownership', (ownership: IOwnership) => ownership.tenant)
  ownerships: IOwnership[];

  get displayName() {
    return this.name;
  }
}
