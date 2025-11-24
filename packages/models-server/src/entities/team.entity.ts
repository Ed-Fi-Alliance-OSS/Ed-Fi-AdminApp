import { IOwnership, IRole, ITeam, IUserTeamMembership } from '@edanalytics/models';
import { Column, Entity, OneToMany } from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
export class Team extends EntityBase implements ITeam {
  @Column()
  name: string;

  @OneToMany(
    'UserTeamMembership',
    (userTeamMembership: IUserTeamMembership) => userTeamMembership.team
  )
  userTeamMemberships: IUserTeamMembership[];

  @OneToMany('Role', (role: IRole) => role.team)
  roles: IRole[];

  @OneToMany('Ownership', (ownership: IOwnership) => ownership.team)
  ownerships: IOwnership[];

  get displayName() {
    return this.name;
  }
}
