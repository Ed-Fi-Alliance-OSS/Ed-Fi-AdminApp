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
  isEnum,
} from 'class-validator';
import { Exclude, Expose, Type, Transform } from 'class-transformer';
import { IRole } from '../interfaces/role.interface';
import { PostDto, DtoPostBase } from '../utils/post-base.dto';
import { RoleType } from '../enums';
import { ITenant, IPrivilege } from '../interfaces';
import { GetPrivilegeDto } from './privilege.dto';
import { privilegeCodes } from '../types';

export class GetRoleDto extends DtoGetBase implements GetDto<IRole, 'tenant'> {
  @Expose()
  name: string;
  @Expose()
  description?: string;
  @Expose()
  @Transform(({ value }) => (value === null ? undefined : value))
  tenantId?: ITenant['id'];
  @Expose()
  type: RoleType;
  @Expose()
  @Type(() => GetPrivilegeDto)
  privileges: IPrivilege[];

  override get displayName() {
    return this.name;
  }
}
export const toGetRoleDto = makeSerializer(GetRoleDto);

export class PutRoleDto
  extends DtoPutBase
  implements PutDto<IRole, 'tenant' | 'type' | 'tenantId' | 'privileges'>
{
  @Expose()
  @IsString()
  @MinLength(3)
  name: string;

  @Expose()
  @IsOptional()
  @IsString()
  description?: string;

  @Expose()
  @IsIn(privilegeCodes, { each: true })
  privileges: string[];
}

export class PostRoleDto extends DtoPostBase implements PostDto<IRole, 'tenant' | 'privileges'> {
  @Expose()
  @IsOptional()
  @IsNumber()
  tenantId?: ITenant['id'];

  @Expose()
  @IsEnum(RoleType)
  type: RoleType;

  @Expose()
  @IsString()
  @MinLength(3)
  name: string;

  @Expose()
  @IsOptional()
  @IsString()
  description?: string;

  @Expose()
  @IsIn(privilegeCodes, { each: true })
  privileges: string[];
}
