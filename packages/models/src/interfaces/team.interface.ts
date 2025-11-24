import { IEntityBase } from '../utils/entity-base.interface';
import { IOwnership } from './ownership.interface';
import { IRole } from './role.interface';
import { IUserTeamMembership } from './user-team-membership.interface';

export interface ITeam extends IEntityBase {
  name: string;
  userTeamMemberships: IUserTeamMembership[];
  ownerships: IOwnership[];
  roles: IRole[];
}
