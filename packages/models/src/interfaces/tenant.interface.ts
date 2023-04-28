import { IEntityBase } from '../utils/entity-base.interface';
import { IOwnership } from './ownership.interface';
import { IRole } from './role.interface';
import { IUserTenantMembership } from './user-tenant-membership.interface';

export interface ITenant extends IEntityBase {
  name: string;
  userTenantMemberships: IUserTenantMembership[];
  ownerships: IOwnership[];
  roles: IRole[];
}
