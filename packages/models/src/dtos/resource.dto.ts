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
import { IResource } from '../interfaces/resource.interface';
import { PostDto, DtoPostBase } from '../utils/post-base.dto';
import { ISbe, IOds, IEdorg } from '../interfaces';
import { GetSbeDto } from './sbe.dto';
import { GetOdsDto } from './ods.dto';
import { GetEdorgDto } from './edorg.dto';

export class GetResourceDto extends DtoGetBase implements GetDto<IResource, 'sbe' | 'ods' | 'edorg' | 'ownerships'> {
  @Expose()
  @Type(() => GetSbeDto)
  sbe?: GetSbeDto | undefined;
  @Expose()
  @Type(() => GetOdsDto)
  ods?: GetOdsDto | undefined;
  @Expose()
  @Type(() => GetEdorgDto)
  edorg?: GetEdorgDto | undefined;

  get resource() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return (this.edorg ?? this.ods ?? this.sbe)!
  }
}
export const toGetResourceDto = makeSerializer<GetResourceDto, IResource>(GetResourceDto);

export class PutResourceDto extends DtoPutBase implements PutDto<IResource, 'ownerships'> { }

export class PostResourceDto extends DtoPostBase implements PostDto<IResource, 'ownerships'> { }
