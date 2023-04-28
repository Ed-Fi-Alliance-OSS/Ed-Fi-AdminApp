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
import { GlobalRole } from '../enums/global-role.enum';
import { IUser, IUserConfig } from '../interfaces/user.interface';
import { EntityBase } from '../utils/entity-base';
import { IUserTenantMembership } from '../interfaces';

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
  @Column()
  givenName: string;

  @FakeMeUsing(faker.name.lastName)
  @Column()
  familyName: string;

  get fullName() {
    return this.givenName + ' ' + this.familyName;
  }

  @FakeMeUsing(() => faker.helpers.arrayElement(enumValues(GlobalRole)))
  @Column({ type: 'varchar', nullable: true })
  role: GlobalRole;

  @OneToMany('UserTenantMembership', (userTenantMembership: IUserTenantMembership) => userTenantMembership.tenant)
  userTenantMemberships: IUserTenantMembership[];

  @FakeMeUsing(() => faker.helpers.arrayElement([false, true, true]))
  @Column()
  isActive: boolean;

  @Column({ type: 'simple-json', nullable: true })
  config?: IUserConfig;
}
