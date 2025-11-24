import { IEntityBase } from '../utils/entity-base.interface';
import { IRole } from './role.interface';
import { ITeam } from './team.interface';
import { IUser } from './user.interface';

export interface IUserTeamMembership extends IEntityBase {
  team: ITeam;
  teamId: ITeam['id'];
  user: IUser;
  userId: IUser['id'];
  role?: IRole;
  roleId?: IRole['id'];
}
