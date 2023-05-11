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
import { ISbe, ISbeConfigPrivate, ISbeConfigPublic } from '../interfaces/sbe.interface';
import { PostDto, DtoPostBase } from '../utils/post-base.dto';
import { IOds, IEdorg } from '../interfaces';
export class SbeConfigPublic implements ISbeConfigPublic {
  @Expose()
  hasOdsRefresh: false;
}

export class SbeConfigPrivate implements ISbeConfigPrivate {
  @Expose()
  adminApiUrl: string;
  @Expose()
  adminApiKey: string;
  @Expose()
  adminApiSecret: string;
  @Expose()
  sbeMetaUrl: string;
  @Expose()
  sbeMetaKey: string;
  @Expose()
  sbeMetaSecret: string;
}

export class GetSbeDto extends DtoGetBase implements GetDto<ISbe, 'resource' | 'odss' | 'edorgs' | 'configPrivate'> {
  @Expose()
  resourceId: number;

  @Expose()
  envLabel: string;
  @Expose()
  @Type(() => SbeConfigPublic)
  configPublic: SbeConfigPublic;

  override get displayName() {
    return this.envLabel;
  }
}
export const toGetSbeDto = makeSerializer(GetSbeDto);

export class PutSbeDto extends DtoPutBase implements PutDto<ISbe, 'resource' | 'resourceId' | 'odss' | 'edorgs' | 'configPrivate'> {
  @Expose()
  envLabel: string;
  @Expose()
  configPublic: SbeConfigPublic;
  @Expose()
  @Type(() => SbeConfigPublic)
  configPrivate?: SbeConfigPrivate;
}

export class PostSbeDto extends DtoPostBase implements PostDto<ISbe, 'resource' | 'resourceId' | 'odss' | 'edorgs' | 'configPrivate'> {
  @Expose()
  odss?: IOds[] | undefined;
  @Expose()
  edorgs?: IEdorg[] | undefined;
  @Expose()
  envLabel: string;
  @Expose()
  @Type(() => SbeConfigPublic)
  configPublic: SbeConfigPublic;
  @Expose()
  @Type(() => SbeConfigPublic)
  configPrivate?: SbeConfigPrivate;
}
