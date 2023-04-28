import { IEntityBase } from '../utils/entity-base.interface';
import { IRole } from './role.interface';
import { ITenant } from './tenant.interface';
import { IUser } from './user.interface';

export interface IUserTenantMembership extends IEntityBase {
  tenant: ITenant;
  tenantId: ITenant['id']
  user: IUser
  userId: IUser['id']
  role?: IRole
  roleId?: IRole['id']
}
