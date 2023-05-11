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
import { IEdorg } from '../interfaces/edorg.interface';
import { PostDto, DtoPostBase } from '../utils/post-base.dto';
import { EdorgType } from '../enums';

export class GetEdorgDto extends DtoGetBase implements GetDto<IEdorg, 'resource' | 'ods' | 'parent' | "children" | "sbe"> {
  @Expose()
  resourceId: number;

  @Expose()
  sbeId: number;
  @Expose()
  odsId: number;

  @Expose()
  parentId?: number;

  @Expose()
  educationOrganizationId: string;
  @Expose()
  nameOfInstitution: string;
  @Expose()
  discriminator: EdorgType;

  override get displayName() {
    return this.nameOfInstitution;
  }
}
export const toGetEdorgDto = makeSerializer(GetEdorgDto);

export class PutEdorgDto extends DtoPutBase implements PutDto<IEdorg, 'resource' | 'ods' | 'odsId' | 'sbe' | 'sbeId' | 'parent' | 'resourceId'> {
  @Expose()
  children: IEdorg[];

  @Expose()
  @IsNumber()
  parentId?: number;

  @IsString()
  @Expose()
  educationOrganizationId: string;

  @IsString()
  @Expose()
  nameOfInstitution: string;

  @Expose()
  discriminator: EdorgType;
}

export class PostEdorgDto extends DtoPostBase implements PostDto<IEdorg, 'resource' | 'ods' | 'parent' | 'resourceId' | 'sbe'> {
  @Expose()
  @IsNumber()
  sbeId: number;

  @Expose()
  @IsNumber()
  odsId: number;

  @Expose()
  children: IEdorg[];

  @Expose()
  @IsNumber()
  parentId?: number;

  @IsString()
  @Expose()
  educationOrganizationId: string;

  @IsString()
  @Expose()
  nameOfInstitution: string;

  @Expose()
  discriminator: EdorgType;

}
