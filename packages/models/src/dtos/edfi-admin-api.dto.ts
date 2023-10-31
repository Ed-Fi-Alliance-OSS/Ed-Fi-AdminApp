import { Expose, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { makeSerializer } from '../utils/make-serializer';
import { GetEdorgDto } from './edorg.dto';
import { GetSbeConfigPublic } from './sbe.dto';

export class PostVendorDto {
  @Expose()
  @IsString()
  @IsNotEmpty()
  company: string;
  @Expose()
  @IsOptional()
  @IsString()
  namespacePrefixes: string;
  @Expose()
  @IsString()
  @IsNotEmpty()
  contactName: string;
  @Expose()
  @IsEmail()
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

class AuthStrategyDto {
  @Expose()
  @IsString()
  @IsOptional()
  authStrategyName: string | null;
  @Expose()
  @IsBoolean()
  isInheritedFromParent: boolean;
}

export class ResourceClaimDto {
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
  @Type(() => AuthStrategyDto)
  @IsArray()
  defaultAuthStrategiesForCRUD: (AuthStrategyDto | null)[];
  @Expose()
  @Type(() => AuthStrategyDto)
  @IsArray()
  authStrategyOverridesForCRUD: (AuthStrategyDto | null)[];

  @Expose()
  @Type(() => ResourceClaimDto)
  @ValidateNested({ each: true })
  children: ResourceClaimDto[];

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
  name: string;

  @Expose()
  @Type(() => ResourceClaimDto)
  @IsNotEmpty({ message: 'Valid JSON for Resource Claims is required' })
  @ValidateNested({ each: true })
  resourceClaims: ResourceClaimDto[];

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

export class PostApplicationDto {
  @Expose()
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  applicationName: string;

  @Expose()
  @IsNumber()
  vendorId: number;

  @Expose()
  @IsString()
  @MinLength(1)
  claimSetName: string;

  @Expose()
  @IsOptional()
  @IsNumber()
  profileId: number;

  @Expose()
  educationOrganizationIds: number[];
}

export class PostApplicationForm {
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

  @Expose()
  @IsOptional()
  @IsNumber()
  profileId: number;

  @Expose()
  @IsNumber()
  educationOrganizationId: number | undefined;
}

export class PostApplicationResponseDto {
  @Expose()
  applicationId: number;
  @Expose()
  key: string;
  @Expose()
  secret: string;
}
export const toPostApplicationResponseDto = makeSerializer(PostApplicationResponseDto);

export class ApplicationYopassResponseDto {
  @Expose()
  applicationId: number;

  @Expose()
  link: string;
}

export const toApplicationYopassResponseDto = makeSerializer(ApplicationYopassResponseDto);

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
  @Expose()
  applicationName: string;
  @Expose()
  claimSetName: string;
  @Expose()
  profileName: string;
  @Expose()
  educationOrganizationId: number;
  @Expose()
  odsInstanceName: string;
  @Expose()
  vendorId: number;
  @Expose()
  @Type(() => ApplicationProfileDto)
  profiles: ApplicationProfileDto[];

  get displayName() {
    return this.applicationName;
  }

  get id() {
    return this.applicationId;
  }

  static apiUrl(
    edorg: Pick<GetEdorgDto, 'educationOrganizationId' | 'shortNameOfInstitution'>,
    hostname: GetSbeConfigPublic['edfiHostname'],
    applicationName: GetApplicationDto['applicationName']
  ) {
    const safe = (str: string) =>
      str
        .toLowerCase()
        .replace(/\s/g, '-')
        .replace(/[^a-z0-9-]/g, '');

    const edorgName = safe(
      edorg.shortNameOfInstitution ?? String(edorg.educationOrganizationId)
    ).slice(0, 22);
    const appName = safe(applicationName).slice(0, 40);
    const slug = `${edorgName}-${appName}`;

    return `https://${slug}.${hostname?.replace(/\/$/, '')}/`;
  }
}

export const toGetApplicationDto = makeSerializer(GetApplicationDto);
