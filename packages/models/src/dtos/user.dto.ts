import { Expose } from 'class-transformer';
import { MinLength } from 'class-validator';
import { GlobalRole } from '../enums';
import type { IUser, IUserConfig } from '../interfaces/user.interface';
import { DtoGetBase__User, GetDto } from '../utils/get-base.dto';
import { makeSerializer } from '../utils/make-serializer';
import { DtoPostBase, PostDto } from '../utils/post-base.dto';
import { DtoPutBase, PutDto } from '../utils/put-base.dto';

export class GetUserDto
  extends DtoGetBase__User
  implements GetDto<IUser, 'userTenantMemberships'>
{
  @Expose()
  username: string;
  @Expose()
  role?: GlobalRole;
  @Expose()
  isActive: boolean;
  @Expose()
  givenName: string;
  @Expose()
  familyName: string;
  @Expose()
  get fullName() {
    return this.givenName + ' ' + this.familyName;
  }
  config?: IUserConfig;

  override get displayName() {
    return this.fullName;
  }
}
export const toGetUserDto = makeSerializer(GetUserDto);

export class PutUserDto
  extends DtoPutBase
  implements PutDto<IUser, 'fullName' | 'userTenantMemberships'>
{
  @Expose()
  username: string;

  @Expose()
  role?: GlobalRole;

  @Expose()
  isActive: boolean;

  @Expose()
  @MinLength(2)
  givenName: string;

  @Expose()
  @MinLength(2)
  familyName: string;

  @Expose()
  config?: IUserConfig;
}

export class PostUserDto
  extends DtoPostBase
  implements PostDto<IUser, 'fullName' | 'userTenantMemberships'>
{
  @Expose()
  username: string;
  @Expose()
  role?: GlobalRole;
  @Expose()
  isActive: boolean;
  @Expose()
  givenName: string;
  @Expose()
  familyName: string;
  @Expose()
  config?: IUserConfig;
}
