import { FakeMeUsing, generateFake } from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import { Expose } from 'class-transformer';
import { makeSerializer } from '../utils/make-serializer';
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

export class PostVendorDto {
  @Expose()
  company: string;
  @Expose()
  namespacePrefixes: string;
  @Expose()
  contactName: string;
  @Expose()
  contactEmailAddress: string;
}

@FakeMeUsing(() => {
  const companyName = faker.company.name();
  const safeName = companyName.replace(/[^\w]+/g, '-').toLowerCase();
  const contactName = faker.name.fullName();
  return {
    vendorId: faker.datatype.number(999999),
    company: companyName,
    namespacePrefixes: `@${safeName}`,
    contactName: contactName,
    contactEmailAddress: `${contactName
      .replace(/\s+/g, '.')
      .toLowerCase()}@${safeName}.com`,
  };
})
export class GetVendorDto extends PostVendorDto {
  @Expose()
  vendorId: number;

  get id() {
    return this.vendorId;
  }

  get displayName() {
    return this.company;
  }
}
export class PutVendorDto extends GetVendorDto {}
export const toGetVendorDto = makeSerializer(GetVendorDto);

class AuthStrategyDto {
  @Expose()
  authStrategyName: string;
  @Expose()
  isInheritedFromParent: boolean;
}

class ResourceClaimDto {
  @Expose()
  @FakeMeUsing(faker.internet.domainWord)
  name: string;
  @Expose()
  @FakeMeUsing(faker.datatype.boolean)
  read: boolean;
  @Expose()
  @FakeMeUsing(faker.datatype.boolean)
  create: boolean;
  @Expose()
  @FakeMeUsing(faker.datatype.boolean)
  update: boolean;
  @Expose()
  @FakeMeUsing(faker.datatype.boolean)
  delete: boolean;
  @Expose()
  @FakeMeUsing(() => [])
  defaultAuthStrategiesForCRUD: AuthStrategyDto[];
  @Expose()
  @FakeMeUsing(() => [])
  authStrategyOverridesForCRUD: AuthStrategyDto[];
  @Expose()
  @FakeMeUsing(() => [])
  children: ResourceClaimDto[];
}

export class PostClaimsetDto {
  @Expose()
  @FakeMeUsing(
    () =>
      faker.helpers.arrayElement(['sis', 'sis - on-prem', 'assessment']) +
      '-' +
      faker.datatype.number(10)
  )
  name: string;
  @Expose()
  @FakeMeUsing(() =>
    generateFake(ResourceClaimDto, undefined, faker.datatype.number(5))
  )
  resourceClaims: ResourceClaimDto[];
}

export class PutClaimsetDto extends PostClaimsetDto {
  @Expose()
  @FakeMeUsing(() => faker.datatype.number(999999))
  id: number;
}
export class GetClaimsetDto extends PutClaimsetDto {
  @Expose()
  @FakeMeUsing(faker.datatype.boolean)
  isSystemReserved: boolean;
  @Expose()
  @FakeMeUsing(0)
  applicationsCount: number;

  get displayName() {
    return this.name;
  }
}
export const toGetClaimsetDto = makeSerializer(GetClaimsetDto);

export class PostApplicationDto {
  @Expose()
  @IsString()
  @MinLength(3)
  applicationName: string;

  @Expose()
  @IsNumber()
  vendorId: string;

  @Expose()
  @IsString()
  @MinLength(1)
  claimSetName: string;

  @Expose()
  @IsOptional()
  @IsNumber()
  profileId: number;

  get educationOrganizationId() {
    return this.educationOrganizationIds?.[0];
  }
  set educationOrganizationId(value: number) {
    this.educationOrganizationIds = [value];
  }

  @Expose()
  @IsNumber(undefined, { each: true })
  @ArrayMaxSize(1)
  @ArrayMinSize(1)
  educationOrganizationIds: number[];
}

export class PostApplicationResponseDto {
  @Expose()
  applicationId: number;
  @Expose()
  key: string;
  @Expose()
  secret: string;
}
export const toPostApplicationResponseDto = makeSerializer(
  PostApplicationResponseDto
);

export class ApplicationYopassResponseDto {
  @Expose()
  applicationId: number;

  @Expose()
  link: string;
}

export const toApplicationYopassResponseDto = makeSerializer(
  ApplicationYopassResponseDto
);

export class PutApplicationDto extends PostApplicationDto {
  @Expose()
  applicationId: number;
}

export class ApplicationResetCredentialResponseDto {
  @Expose()
  applicationId: number;
  @Expose()
  key: string;
  @Expose()
  secret: string;
}

export class GetApplicationDto {
  @Expose()
  @FakeMeUsing(() => faker.datatype.number(999999))
  applicationId: number;
  @Expose()
  @FakeMeUsing(
    () => faker.commerce.department() + ' ' + faker.company.catchPhraseNoun()
  )
  @Expose()
  applicationName: string;
  @Expose()
  claimSetName: string;
  @Expose()
  @FakeMeUsing('default')
  profileName: string;
  @Expose()
  educationOrganizationId: number;
  @Expose()
  odsInstanceName: string;

  get displayName() {
    return this.applicationName;
  }

  get id() {
    return this.applicationId;
  }
}

export const toGetApplicationDto = makeSerializer(GetApplicationDto);
