import { RoleType } from '../enums';
import { PrivilegeCode } from '../types';
import { IEntityBase } from '../utils/entity-base.interface';
import { IPrivilege } from './privilege.interface';
import { ITeam } from './team.interface';

export interface IRole extends IEntityBase {
  name: string;
  description?: string;
  team?: ITeam;
  teamId?: ITeam['id'];
  type: RoleType;
  privilegeIds: PrivilegeCode[];
  privileges: IPrivilege[];
}
