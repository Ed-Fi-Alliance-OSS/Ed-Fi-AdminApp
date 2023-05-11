import { DtoGetBase, GetDto } from '../utils/get-base.dto';
import { makeSerializer } from '../utils/make-serializer';
import { PutDto, DtoPutBase } from '../utils/put-base.dto';
import {
  IsDefined,
  IsOptional,
  Equals,
  NotEquals,
  IsEmpty,
  IsNotEmpty,
  IsIn,
  IsNotIn,
  IsBoolean,
  IsDate,
  IsString,
  IsNumber,
  IsInt,
  IsArray,
  IsEnum,
  IsDivisibleBy,
  IsPositive,
  IsNegative,
  Min,
  Max,
  MinDate,
  MaxDate,
  IsBooleanString,
  IsDateString,
  IsNumberString,
  Contains,
  NotContains,
  IsAlpha,
  IsAlphanumeric,
  IsDecimal,
  IsAscii,
  IsBase32,
  IsBase58,
  IsBase64,
  IsIBAN,
  IsBIC,
  IsByteLength,
  IsCreditCard,
  IsCurrency,
  IsISO4217CurrencyCode,
  IsEthereumAddress,
  IsBtcAddress,
  IsDataURI,
  IsEmail,
  IsFQDN,
  IsFullWidth,
  IsHalfWidth,
  IsVariableWidth,
  IsHexColor,
  IsHSL,
  IsRgbColor,
  IsIdentityCard,
  IsPassportNumber,
  IsPostalCode,
  IsHexadecimal,
  IsOctal,
  IsMACAddress,
  IsIP,
  IsPort,
  IsISBN,
  IsEAN,
  IsISIN,
  IsISO8601,
  IsJSON,
  IsJWT,
  IsObject,
  IsNotEmptyObject,
  IsLowercase,
  IsLatLong,
  IsLatitude,
  IsLongitude,
  IsMobilePhone,
  IsISO31661Alpha2,
  IsISO31661Alpha3,
  IsLocale,
  IsPhoneNumber,
  IsMongoId,
  IsMultibyte,
  IsSurrogatePair,
  IsTaxId,
  IsUrl,
  IsMagnetURI,
  IsUUID,
  IsFirebasePushId,
  IsUppercase,
  Length,
  MinLength,
  MaxLength,
  Matches,
  IsMilitaryTime,
  IsTimeZone,
  IsHash,
  IsMimeType,
  IsSemVer,
  IsISSN,
  IsISRC,
  IsRFC3339,
  IsStrongPassword,
  ArrayContains,
  ArrayNotContains,
  ArrayNotEmpty,
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  IsInstance,
  Allow,
} from 'class-validator';
import { Exclude, Expose, Type, Transform } from 'class-transformer';
import { IUserTenantMembership } from '../interfaces/user-tenant-membership.interface';
import { PostDto, DtoPostBase } from '../utils/post-base.dto';
import { ITenant, IUser, IRole } from '../interfaces';

export class GetUserTenantMembershipDto
  extends DtoGetBase
  implements GetDto<IUserTenantMembership, "tenant" | "user" | "role">
{
  @Expose()
  tenantId: ITenant['id']
  @Expose()
  userId: IUser['id']
  @Expose()
  roleId?: IRole['id']
}
export const toGetUserTenantMembershipDto = makeSerializer(
  GetUserTenantMembershipDto
);

export class PutUserTenantMembershipDto
  extends DtoPutBase
  implements PutDto<IUserTenantMembership, "tenant" | "user" | "role" | "tenantId" | "userId">
{
  @Expose()
  roleId: IRole['id']
}

export class PostUserTenantMembershipDto
  extends DtoPostBase
  implements PostDto<IUserTenantMembership, "tenant" | "user" | "role">
{
  @Expose()
  tenantId: ITenant['id']
  @Expose()
  userId: IUser['id']
  @Expose()
  roleId: IRole['id']
}
