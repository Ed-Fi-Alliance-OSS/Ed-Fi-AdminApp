import { IRole, IUser, IUserTeamMembership, UserType } from '@edanalytics/models';
import { Type } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import * as config from 'config';

@Index(['username'], { unique: true })
@Index(['clientId'], { unique: true })
@Entity()
export class User implements IUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Type(() => Date)
  @CreateDateColumn()
  created: Date;

  @Type(() => Date)
  @UpdateDateColumn()
  modified?: Date | undefined;

  @ManyToOne('User', { nullable: true, onDelete: 'SET NULL' })
  createdBy?: IUser | undefined;

  @Column({ nullable: true })
  createdById?: IUser['id'] | undefined;

  @ManyToOne('User', { nullable: true, onDelete: 'SET NULL' })
  modifiedBy?: IUser | undefined;

  @Column({ nullable: true })
  modifiedById: IUser['id'];

  @Column({ type: config.DB_ENGINE === 'pgsql' ? 'citext' : 'nvarchar' })
  username: string;

  @Column({ nullable: true })
  givenName: string | null;

  @Column({ nullable: true })
  familyName: string | null;

  /**
   * @description clientId is used for machines
   */
  @Column({ nullable: true })
  clientId: string | null;

  /**
   * @description description is used for machines
   */
  @Column({ nullable: true })
  description: string | null;

  @ManyToOne('Role', { nullable: true, onDelete: 'SET NULL' })
  role?: IRole;

  @Column({ nullable: true })
  roleId?: IRole['id'];

  @OneToMany(
    'UserTeamMembership',
    (userTeamMembership: IUserTeamMembership) => userTeamMembership.user
  )
  userTeamMemberships: IUserTeamMembership[];

  @Column()
  isActive: boolean;

  @Column({
    type: config.DB_ENGINE === 'pgsql' ? 'enum' : 'nvarchar',
    enum: ['human', 'machine'],
    default: 'human',
  })
  userType: UserType;

  get fullName() {
    return typeof this.givenName === 'string' &&
      typeof this.familyName === 'string' &&
      this.givenName !== '' &&
      this.familyName !== ''
      ? this.givenName + ' ' + this.familyName
      : this.username;
  }

  get displayName() {
    return this.fullName;
  }
}
