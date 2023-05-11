import { IPrivilege, IRole, ITenant, RoleType } from '@edanalytics/models';
import {
  FakeMeUsing
} from '@edanalytics/utils';
import _ from 'lodash';
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne
} from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
export class Role extends EntityBase implements IRole {
  @Column()
  @FakeMeUsing(() => '' + _.sample(['Admin', 'User', 'Mgr', 'IT', 'Full admin', 'Superuser', 'Super big everything-user', 'Read-only', 'Full access', 'Test', 'Bjorn', 'Mark', 'Eshara']) + _.sample(['', '', '', '', '-copy', '-2', '-3']))
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
