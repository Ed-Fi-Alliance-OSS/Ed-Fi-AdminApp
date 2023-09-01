import { IRole, ITenant, IUser, IUserTenantMembership } from '@edanalytics/models';
import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
@Unique(['tenantId', 'userId'])
export class UserTenantMembership extends EntityBase implements IUserTenantMembership {
  @ManyToOne('Tenant', (tenant: ITenant) => tenant.userTenantMemberships, { onDelete: 'CASCADE' })
  tenant: ITenant;
  @Column()
  tenantId: ITenant['id'];
  @ManyToOne('User', (user: IUser) => user.userTenantMemberships, { onDelete: 'CASCADE' })
  user: IUser;
  @Column()
  userId: IUser['id'];
  @ManyToOne('Role', { nullable: true, onDelete: 'SET NULL' })
  role?: IRole;
  @Column({ nullable: true })
  roleId?: IRole['id'];

  get displayName() {
    return String(this.id);
  }
}
