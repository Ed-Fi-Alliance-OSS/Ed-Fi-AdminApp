import { IUser } from '../interfaces/user.interface';

export interface IEntityBase {
  id: number;
  createdBy?: IUser;
  createdById?: IUser['id'];
  modifiedBy?: IUser;
  modifiedById?: IUser['id'];
  created: Date;
  modified?: Date;

  displayName: string;
}
