import { DtoGetBase, GetDto } from '../utils/dto-get-base';
import { makeSerializer } from '../utils/make-serializer';
import { PutDto, DtoPutBase } from '../utils/dto-put-base';
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
import { IRole } from '../interfaces/role.interface';
import { PostDto, DtoPostBase } from '../utils/dto-post-base';
import { RoleType } from '../enums';
import { ITenant, IPrivilege } from '../interfaces';

export class GetRoleDto extends DtoGetBase implements GetDto<IRole, 'tenant'> {
  @Expose()
  name: string;
  @Expose()
  description?: string;
  @Expose()
  tenantId?: ITenant['id']
  @Expose()
  type: RoleType
  @Expose()
  privileges: IPrivilege[];

  override get displayName() {
    return this.name;
  }
}
export const toGetRoleDto = makeSerializer(GetRoleDto);

export class PutRoleDto extends DtoPutBase implements PutDto<IRole, 'tenant' | 'type' | 'tenantId'> {
  @Expose()
  name: string;
  @Expose()
  description?: string;
  @Expose()
  privileges: IPrivilege[];
}

export class PostRoleDto extends DtoPostBase implements PostDto<IRole, 'tenant'> {
  @Expose()
  name: string;
  @Expose()
  description?: string;
  @Expose()
  tenantId?: ITenant['id']
  @Expose()
  type: RoleType
  @Expose()
  privileges: IPrivilege[];
}
