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
import { IUserTenantMembership } from '../interfaces/user-tenant-membership.interface';
import { EntityBase } from '../utils/entity-base';
import {
  FakeMeUsing,
  deployEnv,
  schoolYear,
  districtName,
  schoolType,
} from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import { ITenant, IUser, IRole } from '../interfaces';

@Entity()
export class UserTenantMembership
  extends EntityBase
  implements IUserTenantMembership {
  @ManyToOne('Tenant', (tenant: ITenant) => tenant.userTenantMemberships)
  tenant: ITenant;
  @Column()
  tenantId: ITenant['id']
  @ManyToOne('User', (user: IUser) => user.userTenantMemberships)
  user: IUser
  @Column()
  userId: IUser['id']
  @ManyToOne('Role', { nullable: true })
  role?: IRole
  @Column({ nullable: true })
  roleId?: IRole['id']
}
