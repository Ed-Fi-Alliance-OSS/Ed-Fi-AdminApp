import { Expose } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { TrimWhitespace } from '../utils';
import type { IUser, UserType } from '../interfaces/user.interface';
import { DtoGetBase__User, GetDto } from '../utils/get-base.dto';
import { makeSerializer } from '../utils/make-serializer';
import { DtoPostBase, PostDto } from '../utils/post-base.dto';
import { DtoPutBase, PutDto } from '../utils/put-base.dto';

export class GetUserDto
  extends DtoGetBase__User
  implements GetDto<IUser, 'userTeamMemberships' | 'role'>
{
  @Expose()
  username: string;
  @Expose()
  roleId?: number;
  @Expose()
  isActive: boolean;
  @Expose()
  givenName: string | null;
  @Expose()
  familyName: string | null;
  @Expose()
  clientId: string | null;
  @Expose()
  description: string | null;
  @Expose()
  userType: UserType;
  // This is not stored. It is here so the link can be passed back to the user.
  @Expose()
  yopassLink?: string;

  get fullName() {
    if (this.userType === 'machine') {
      return this.username;
    }
    return typeof this.givenName === 'string' &&
      typeof this.familyName === 'string' &&
      this.givenName !== '' &&
      this.familyName !== ''
      ? this.givenName + ' ' + this.familyName
      : this.username;
  }

  override get displayName() {
    return this.fullName;
  }
}
export const toGetUserDto = makeSerializer(GetUserDto);

export class PutUserDto
  extends DtoPutBase
  implements
    PutDto<
      IUser,
      | 'fullName'
      | 'userTeamMemberships'
      | 'role'
      | 'givenName'
      | 'familyName'
      | 'clientId'
      | 'description'
      | 'userType'
    >
{
  @Expose()
  @MinLength(2)
  @TrimWhitespace()
  username: string;

  @Expose()
  @IsNumber()
  @IsOptional()
  roleId?: number;

  @Expose()
  @IsBoolean()
  isActive: boolean;

  @Expose()
  @IsOptional()
  @IsString()
  @TrimWhitespace()
  givenName?: string | null;

  @Expose()
  @IsOptional()
  @IsString()
  @TrimWhitespace()
  familyName?: string | null;

  @Expose()
  @IsOptional()
  @IsString()
  @TrimWhitespace()
  description?: string | null;
}

export class PostUserDto
  extends DtoPostBase
  implements
    PostDto<
      IUser,
      | 'fullName'
      | 'userTeamMemberships'
      | 'role'
      | 'givenName'
      | 'familyName'
      | 'clientId'
      | 'description'
    >
{
  @Expose()
  @MinLength(2)
  @TrimWhitespace()
  username: string;

  @Expose()
  @IsNumber()
  @IsOptional()
  roleId?: number;

  @Expose()
  @IsBoolean()
  isActive: boolean;

  @Expose()
  @IsOptional()
  @MinLength(2)
  @TrimWhitespace()
  givenName?: string | null;

  @Expose()
  @IsOptional()
  @MinLength(2)
  @TrimWhitespace()
  familyName?: string | null;

  @Expose()
  @IsOptional()
  @MinLength(2)
  @TrimWhitespace()
  clientId?: string | null;

  @Expose()
  @IsOptional()
  @MinLength(2)
  @TrimWhitespace()
  description?: string | null;

  @Expose()
  userType: UserType;
}
