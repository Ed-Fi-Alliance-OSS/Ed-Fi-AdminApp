import { IPrivilege } from '@edanalytics/models';
import {
  Column,
  Entity,
  PrimaryColumn
} from 'typeorm';

@Entity()
export class Privilege implements IPrivilege {
  @PrimaryColumn()
  name: string;
  @Column()
  description: string;
  @Column()
  code: string;
}
