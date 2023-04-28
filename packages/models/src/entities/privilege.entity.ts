import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  ManyToMany,
  ViewColumn,
  ViewEntity,
  BeforeInsert,
  JoinColumn,
  JoinTable,
  PrimaryColumn,
} from 'typeorm';
import { IPrivilege } from '../interfaces/privilege.interface';
import { EntityBase } from '../utils/entity-base';
import {
  FakeMeUsing,
  deployEnv,
  schoolYear,
  districtName,
  schoolType,
} from '@edanalytics/utils';
import { faker } from '@faker-js/faker';

@Entity()
export class Privilege implements IPrivilege {
  @PrimaryColumn()
  name: string;
  @Column()
  description: string;
  @Column()
  code: string;
}
