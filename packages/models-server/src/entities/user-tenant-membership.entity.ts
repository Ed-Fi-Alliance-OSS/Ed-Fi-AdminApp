import { IRole, ITeam, IUser, IUserTeamMembership } from '@edanalytics/models';
import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
@Unique(['teamId', 'userId'])
export class UserTeamMembership extends EntityBase implements IUserTeamMembership {
  @ManyToOne('Team', (team: ITeam) => team.userTeamMemberships, { onDelete: 'CASCADE' })
  team: ITeam;
  @Column()
  teamId: ITeam['id'];
  @ManyToOne('User', (user: IUser) => user.userTeamMemberships, { onDelete: 'CASCADE' })
  user: IUser;
  @Column()
  userId: IUser['id'];
  @ManyToOne('Role', { nullable: true, onDelete: 'SET NULL' })
  role?: IRole;
  @Column({ nullable: true })
  roleId?: IRole['id'];

  get displayName() {
    return String(this.id);
  }
}
