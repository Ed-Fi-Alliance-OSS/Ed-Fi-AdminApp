import { IEntityBase } from '../utils/entity-base.interface';
import { IResource } from './resource.interface';
import { IRole } from './role.interface';
import { ITenant } from './tenant.interface';

export interface IOwnership extends IEntityBase {
  tenant: ITenant;
  tenantId: ITenant['id'];
  role: IRole;
  roleId: IRole['id']
  resource: IResource;
  resourceId: IResource['id']
}
