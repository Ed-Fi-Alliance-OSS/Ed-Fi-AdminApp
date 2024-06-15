import { Expose, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TrimWhitespace } from '../utils';
import { makeSerializer } from '../utils/make-serializer';
import { GetEdorgDto } from './edorg.dto';
import { SbaaAdminApiVersion } from '../interfaces';

export class PostVendorDto {
  @Expose()
  @IsString()
  @IsNotEmpty()
  @TrimWhitespace()
  company: string;
  @Expose()
  @IsOptional()
  @IsString()
  @TrimWhitespace()
  namespacePrefixes: string;
  @Expose()
  @IsString()
  @IsNotEmpty()
  @TrimWhitespace()
  contactName: string;
  @Expose()
  @IsEmail()
  @TrimWhitespace()
  contactEmailAddress: string;
}

export class GetVendorDto extends PostVendorDto {
  @Expose()
  @IsNumber()
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

class ApplicationProfileDto {
  @Expose()
  id: number;
}

class AuthStrategyDto130 {
  @Expose()
  @IsString()
  @IsOptional()
  authStrategyName: string | null;
  @Expose()
  @IsBoolean()
  isInheritedFromParent: boolean;
}

class AuthStrategyDto131 {
  @Expose()
  @ValidateNested()
  authorizationStrategies: AuthStrategyDto130[];
}

export class ResourceClaimDto131 {
  @Expose()
  @IsString()
  name: string;
  @Expose()
  @IsBoolean()
  read: boolean;
  @Expose()
  @IsBoolean()
  create: boolean;
  @Expose()
  @IsBoolean()
  update: boolean;
  @Expose()
  @IsBoolean()
  delete: boolean;
  @Expose()
  @IsOptional()
  @IsBoolean()
  readChanges?: boolean | undefined;
  @Expose()
  @Type(() => AuthStrategyDto131)
  @IsArray()
  defaultAuthStrategiesForCRUD: (AuthStrategyDto131 | null)[];
  @Expose()
  @Type(() => AuthStrategyDto131)
  @IsArray()
  authStrategyOverridesForCRUD: (AuthStrategyDto131 | null)[];

  @Expose()
  @Type(() => ResourceClaimDto131)
  @ValidateNested({ each: true })
  children: ResourceClaimDto131[];

  /*
  These are originally arrays of null or object. We want to validate
  the objects but let the nulls through. These filtered getters let us
  do that easily with class-transformer.
  */
  @ValidateNested({ each: true })
  get _defaultAuthStrategiesForCRUD() {
    return this.defaultAuthStrategiesForCRUD?.filter((v) => v !== null);
  }

  @ValidateNested({ each: true })
  get _authStrategyOverridesForCRUD() {
    return this.authStrategyOverridesForCRUD?.filter((v) => v !== null);
  }
}

export class PostClaimsetDto {
  @Expose()
  @IsString()
  @IsNotEmpty()
  @TrimWhitespace()
  name: string;

  @Expose()
  @Type(() => ResourceClaimDto131)
  @IsNotEmpty({ message: 'Valid JSON for Resource Claims is required' })
  @ValidateNested({ each: true })
  resourceClaims: ResourceClaimDto131[];

  /*
  These are used to power the plain text JSON editor in the UI.
  */
  get resourceClaimsJson() {
    return JSON.stringify(this.resourceClaims, null, 2);
  }

  set resourceClaimsJson(value: string) {
    try {
      this.resourceClaims = JSON.parse(value);
    } catch (invalidJsonError) {
      this.resourceClaims = undefined as any;
    }
  }
}

export class PutClaimsetDto extends PostClaimsetDto {
  @Expose()
  @IsNumber()
  id: number;
}
export class GetClaimsetDto extends PutClaimsetDto {
  @Expose()
  isSystemReserved: boolean;
  @Expose()
  applicationsCount: number;

  get displayName() {
    return this.name;
  }
}
export const toGetClaimsetDto = makeSerializer(GetClaimsetDto);

export class PostApplicationDtoBase {
  @Expose()
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @TrimWhitespace()
  applicationName: string;

  @Expose()
  @IsNumber()
  vendorId: number;

  @Expose()
  @IsString()
  @MinLength(1)
  claimSetName: string;
}
export class PostApplicationDto extends PostApplicationDtoBase {
  @Expose()
  @IsOptional()
  @IsNumber()
  profileId: number;

  @Expose()
  educationOrganizationIds: number[];
}

export class PostApplicationFormBase {
  @Expose()
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  applicationName: string;

  @Expose()
  @IsNumber()
  vendorId: number;

  @Expose()
  @IsNumber()
  claimsetId: number;
}
export class PostApplicationForm extends PostApplicationFormBase {
  @Expose()
  @IsOptional()
  @IsNumber()
  profileId: number;

  @Expose()
  @IsNumber()
  educationOrganizationId: number;
}

// This is a response to a Post and is really a Get DTO
// Therefore whitespace should not be trimmed
export class PostApplicationResponseDtoBase {
  @Expose()
  key: string;
  @Expose()
  secret: string;
}

export class PostApplicationResponseDto extends PostApplicationResponseDtoBase {
  @Expose()
  applicationId: number;
}

export const toPostApplicationResponseDto = makeSerializer(PostApplicationResponseDto);

// This is a Get DTO that should not have whitespace trimmed
export class ApplicationYopassResponseDto {
  @Expose()
  applicationId: number;

  @Expose()
  link: string;

  get id() {
    return this.applicationId;
  }
}

export const toApplicationYopassResponseDto = makeSerializer<
  ApplicationYopassResponseDto,
  Omit<ApplicationYopassResponseDto, 'id'>
>(ApplicationYopassResponseDto);

export class PutApplicationDto extends PostApplicationDto {
  @Expose()
  applicationId: number;

  get id() {
    return this.applicationId;
  }
}

export class PutApplicationForm extends PostApplicationForm {
  @Expose()
  applicationId: number;

  get id() {
    return this.applicationId;
  }
}

// This is a Get DTO that should not have whitespace trimmed
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
  applicationId: number;
  @Expose()
  applicationName: string;
  @Expose()
  claimSetName: string;
  @Expose()
  profileName: string;
  @Expose()
  educationOrganizationId: number;
  @Expose()
  educationOrganizationIds: number[];
  @Expose()
  odsInstanceName: string;
  @Expose()
  vendorId: number;
  @Expose()
  @Type(() => ApplicationProfileDto)
  profiles: ApplicationProfileDto[];

  get _educationOrganizationIds() {
    return this.educationOrganizationIds ?? [this.educationOrganizationId];
  }

  get displayName() {
    return this.applicationName;
  }

  get id() {
    return this.applicationId;
  }

  static apiUrl(domain: string, applicationName: GetApplicationDto['applicationName']) {
    const safe = (str: string) =>
      str
        .toLowerCase()
        .replace(/\s/g, '-')
        .replace(/[^a-z0-9-]/g, '');

    const appName = safe(applicationName).slice(0, 40);
    const url = new URL(domain);
    url.protocol = 'https:';
    url.hostname = `${appName}.${url.hostname}`;

    return url.toString();
  }
}

export const toGetApplicationDto = makeSerializer(GetApplicationDto);

export type AdminApiMeta = { version: '1.0' | '1.1' | '1.2' | '1.3' | '2.0' };
export const importantAdminApiVersions: Record<AdminApiMeta['version'], SbaaAdminApiVersion> = {
  '1.0': 'v1',
  '1.1': 'v1',
  '1.2': 'v1',
  '1.3': 'v1',
  '2.0': 'v2',
};
