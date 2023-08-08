import { IUser } from '../interfaces/user.interface';

export interface IEntityBase {
  id: number;
  createdBy?: IUser;
  createdById?: IUser['id'];
  modifiedBy?: IUser;
  modifiedById?: IUser['id'];
  deletedBy?: IUser;
  deletedById?: IUser['id'];
  created: Date;
  modified?: Date;
  deleted?: Date;

  displayName: string;
}
