import { IRole, ITenant, IUser, IUserTenantMembership } from '@edanalytics/models';
import { Column, Entity, ManyToOne } from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
export class UserTenantMembership extends EntityBase implements IUserTenantMembership {
  @ManyToOne('Tenant', (tenant: ITenant) => tenant.userTenantMemberships)
  tenant: ITenant;
  @Column()
  tenantId: ITenant['id'];
  @ManyToOne('User', (user: IUser) => user.userTenantMemberships)
  user: IUser;
  @Column()
  userId: IUser['id'];
  @ManyToOne('Role', { nullable: true })
  role?: IRole;
  @Column({ nullable: true })
  roleId?: IRole['id'];

  get displayName() {
    return String(this.id);
  }
}
