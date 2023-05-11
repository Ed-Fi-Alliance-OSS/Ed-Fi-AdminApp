import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Type } from 'class-transformer';
import { IEntityBase, IUser } from '@edanalytics/models';

export class EntityBase implements IEntityBase {
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

  @ManyToOne('User')
  createdBy: IUser;

  @Column()
  createdById: IUser['id'];

  @ManyToOne('User', { nullable: true })
  modifiedBy?: IUser | undefined;

  @Column({ nullable: true })
  modifiedById?: IUser['id'];

  @ManyToOne('User', { nullable: true })
  deletedBy?: IUser | undefined;

  @Column({ nullable: true })
  deletedById?: IUser['id'];
}
