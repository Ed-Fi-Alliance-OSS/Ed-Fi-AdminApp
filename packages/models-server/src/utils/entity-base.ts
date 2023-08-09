import { IEntityBase, IUser } from '@edanalytics/models';
import { Type } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export class EntityBase implements IEntityBase {
  @PrimaryGeneratedColumn()
  id: number;

  @Type(() => Date)
  @CreateDateColumn()
  created: Date;

  @Type(() => Date)
  @UpdateDateColumn()
  modified?: Date | undefined;

  @ManyToOne('User')
  createdBy?: IUser;

  @Column({ nullable: true })
  createdById?: IUser['id'];

  @ManyToOne('User', { nullable: true })
  modifiedBy?: IUser | undefined;

  @Column({ nullable: true })
  modifiedById?: IUser['id'];

  get displayName() {
    return String(this.id);
  }
}
