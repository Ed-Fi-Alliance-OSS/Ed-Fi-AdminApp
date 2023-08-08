import { GlobalRole, IRole, IUser, IUserConfig, IUserTenantMembership } from '@edanalytics/models';
import { enumValues, FakeMeUsing } from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import { Type } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
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

  @Type(() => Date)
  @DeleteDateColumn()
  deleted?: Date | undefined;

  @ManyToOne('User', { nullable: true })
  createdBy?: IUser | undefined;

  @Column({ nullable: true })
  createdById?: IUser['id'] | undefined;

  @ManyToOne('User', { nullable: true })
  modifiedBy?: IUser | undefined;

  @Column({ nullable: true })
  modifiedById: IUser['id'];

  @ManyToOne('User', { nullable: true })
  deletedBy?: IUser | undefined;

  @Column({ nullable: true })
  deletedById: IUser['id'];

  @FakeMeUsing(faker.internet.userName)
  @Column()
  username: string;

  @FakeMeUsing(faker.name.firstName)
  @Column({ nullable: true })
  givenName: string | null;

  @FakeMeUsing(faker.name.lastName)
  @Column({ nullable: true })
  familyName: string | null;

  @ManyToOne('Role', { nullable: true })
  role?: IRole;

  @Column({ nullable: true })
  roleId?: IRole['id'];

  @OneToMany(
    'UserTenantMembership',
    (userTenantMembership: IUserTenantMembership) => userTenantMembership.user
  )
  userTenantMemberships: IUserTenantMembership[];

  @FakeMeUsing(() => faker.helpers.arrayElement([false, true, true]))
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
