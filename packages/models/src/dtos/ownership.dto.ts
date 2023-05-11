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
import { IOwnership } from '../interfaces/ownership.interface';
import { PostDto, DtoPostBase } from '../utils/post-base.dto';
import { ITenant, IRole, IResource } from '../interfaces';
import { GetResourceDto } from './resource.dto';

export class GetOwnershipDto extends DtoGetBase implements GetDto<IOwnership, 'tenant' | 'role' | 'resourceId' | 'resource'> {
  @Expose()
  tenantId: ITenant['id'];
  @Expose()
  roleId: IRole['id']
  @Expose()
  @Type(() => GetResourceDto)
  resource: GetResourceDto
}
export const toGetOwnershipDto = makeSerializer<GetOwnershipDto, IOwnership>(GetOwnershipDto);

export class PutOwnershipDto extends DtoPutBase implements PutDto<IOwnership, 'tenant' | 'role' | 'resource' | 'tenantId' | 'resourceId'> {
  @Expose()
  roleId: IRole['id']
}

export class PostOwnershipDto
  extends DtoPostBase
  implements PostDto<IOwnership, 'tenant' | 'role' | 'resource'>
{
  @Expose()
  tenantId: ITenant['id'];
  @Expose()
  roleId: IRole['id']
  @Expose()
  resourceId: IResource['id']
}
