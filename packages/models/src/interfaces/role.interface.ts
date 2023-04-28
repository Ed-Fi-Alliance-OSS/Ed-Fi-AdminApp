import { RoleType } from '../enums';
import { IEntityBase } from '../utils/entity-base.interface';
import { IPrivilege } from './privilege.interface';
import { ITenant } from './tenant.interface';

export interface IRole extends IEntityBase {
  name: string;
  description?: string;
  tenant?: ITenant;
  tenantId?: ITenant['id']
  type: RoleType
  privileges: IPrivilege[];
}
