import { IRole, IUser, IUserConfig, IUserTenantMembership } from '@edanalytics/models';
import { Type } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @Column()
  username: string;

  @Column({ nullable: true })
  givenName: string | null;

  @Column({ nullable: true })
  familyName: string | null;

  @ManyToOne('Role', { nullable: true, onDelete: 'SET NULL' })
  role?: IRole;

  @Column({ nullable: true })
  roleId?: IRole['id'];

  @OneToMany(
    'UserTenantMembership',
    (userTenantMembership: IUserTenantMembership) => userTenantMembership.user
  )
  userTenantMemberships: IUserTenantMembership[];

  @Column()
  isActive: boolean;

  @Column({ type: 'simple-json', nullable: true })
  config?: IUserConfig;

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
