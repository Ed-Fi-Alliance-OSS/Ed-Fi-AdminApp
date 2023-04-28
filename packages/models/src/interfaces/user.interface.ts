import { GlobalRole } from '../enums/global-role.enum';
import { IEntityBase } from '../utils/entity-base.interface';
import { IUserTenantMembership } from './user-tenant-membership.interface';

export interface IUserConfig {
  confirmDeletion?: boolean;
}

export interface IUser extends Omit<IEntityBase, 'createdBy' | 'createdById'> {
  username: string;
  givenName: string;
  familyName: string;
  fullName: string;
  role?: GlobalRole;
  config?: IUserConfig;
  isActive: boolean;
  userTenantMemberships: IUserTenantMembership[];

  // make these optional
  createdBy?: IUser | undefined;
  createdById?: number | undefined;
}
