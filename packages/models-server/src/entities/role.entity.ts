import { IRole, ITeam, PRIVILEGES, PrivilegeCode, RoleType } from '@edanalytics/models';
import { Column, Entity, ManyToOne } from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
export class Role extends EntityBase implements IRole {
  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @ManyToOne('Team', (team: ITeam) => team.roles, { nullable: true, onDelete: 'CASCADE' })
  team?: ITeam;

  @Column({ nullable: true })
  teamId?: ITeam['id'];

  @Column({ type: 'simple-json' })
  type: RoleType;

  @Column({ type: 'simple-array', default: '' })
  privilegeIds: PrivilegeCode[];

  get privileges() {
    return this.privilegeIds.map((code) => PRIVILEGES[code]);
  }
  get displayName() {
    return this.name;
  }
}
