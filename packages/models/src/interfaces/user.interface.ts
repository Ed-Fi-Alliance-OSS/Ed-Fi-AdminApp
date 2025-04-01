import { IRole } from '.';
import { IEntityBase } from '../utils/entity-base.interface';
import { IUserTeamMembership } from './user-team-membership.interface';

export interface IUserConfig {
  confirmDeletion?: boolean;
}

export type UserType = 'human' | 'machine';

export interface IUser extends Omit<IEntityBase, 'createdBy' | 'createdById'> {
  username: string;
  givenName: string | null;
  familyName: string | null;
  clientId: string | null;
  description: string | null;
  fullName: string;
  role?: IRole;
  config?: IUserConfig;
  userType: UserType;
  isActive: boolean;
  userTeamMemberships: IUserTeamMembership[];

  // make these optional
  createdBy?: IUser | undefined;
  createdById?: number | undefined;
}
