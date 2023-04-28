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
import { ISbe } from '../interfaces/sbe.interface';
import { PostDto, DtoPostBase } from '../utils/dto-post-base';
import { SbeMeta } from '../types';
import { IOds, IEdorg } from '../interfaces';

export class GetSbeDto extends DtoGetBase implements GetDto<ISbe, 'resource' | 'odss' | 'edorgs'> {
  @Expose()
  resourceId: number;

  @Expose()
  envLabel: string;
  @Expose()
  meta: SbeMeta;

  override get displayName() {
    return this.envLabel;
  }
}
export const toGetSbeDto = makeSerializer(GetSbeDto);

export class PutSbeDto extends DtoPutBase implements PutDto<ISbe, 'resource' | 'resourceId' | 'odss' | 'edorgs'> {
  @Expose()
  envLabel: string;
  @Expose()
  meta: SbeMeta;
}

export class PostSbeDto extends DtoPostBase implements PostDto<ISbe, 'resource' | 'resourceId' | 'odss' | 'edorgs'> {
  @Expose()
  odss?: IOds[] | undefined;
  @Expose()
  edorgs?: IEdorg[] | undefined;
  @Expose()
  envLabel: string;
  @Expose()
  meta: SbeMeta;
}
