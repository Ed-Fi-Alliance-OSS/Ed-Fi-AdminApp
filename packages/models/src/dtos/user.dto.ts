import { Expose } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { TrimWhitespace } from '../utils';
import type { IUser, IUserConfig } from '../interfaces/user.interface';
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
  givenName: string;
  @Expose()
  familyName: string;

  get fullName() {
    return typeof this.givenName === 'string' &&
      typeof this.familyName === 'string' &&
      this.givenName !== '' &&
      this.familyName !== ''
      ? this.givenName + ' ' + this.familyName
      : this.username;
  }
  config?: IUserConfig;

  override get displayName() {
    return this.fullName;
  }
}
export const toGetUserDto = makeSerializer(GetUserDto);

export class PutUserDto
  extends DtoPutBase
  implements
    PutDto<IUser, 'fullName' | 'userTeamMemberships' | 'role' | 'givenName' | 'familyName'>
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
}

export class PostUserDto
  extends DtoPostBase
  implements
    PostDto<IUser, 'fullName' | 'userTeamMemberships' | 'role' | 'givenName' | 'familyName'>
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
}
