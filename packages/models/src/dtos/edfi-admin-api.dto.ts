import { Expose, Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { makeSerializer } from '../utils/make-serializer';
import { GetEdorgDto } from './edorg.dto';
import { GetSbeConfigPublic } from './sbe.dto';

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

class ApplicationProfileDto {
  @Expose()
  id: number;
}

class AuthStrategyDto {
  @Expose()
  authStrategyName: string;
  @Expose()
  isInheritedFromParent: boolean;
}

class ResourceClaimDto {
  @Expose()
  name: string;
  @Expose()
  read: boolean;
  @Expose()
  create: boolean;
  @Expose()
  update: boolean;
  @Expose()
  delete: boolean;
  @Expose()
  defaultAuthStrategiesForCRUD: AuthStrategyDto[];
  @Expose()
  authStrategyOverridesForCRUD: AuthStrategyDto[];
  @Expose()
  children: ResourceClaimDto[];
}

export class PostClaimsetDto {
  @Expose()
  name: string;
  @Expose()
  resourceClaims: ResourceClaimDto[];
}

export class PutClaimsetDto extends PostClaimsetDto {
  @Expose()
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

export class PostApplicationForm extends (PostApplicationDto as any as {
  new (): Omit<PostApplicationDto, 'educationOrganizationIds'>;
}) {
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
