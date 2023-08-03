import { FakeMeUsing, generateFake } from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
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

@FakeMeUsing(() => {
  const companyName = faker.company.name();
  const safeName = companyName.replace(/[^\w]+/g, '-').toLowerCase();
  const contactName = faker.name.fullName();
  return {
    vendorId: faker.datatype.number(999999),
    company: companyName,
    namespacePrefixes: `@${safeName}`,
    contactName: contactName,
    contactEmailAddress: `${contactName.replace(/\s+/g, '.').toLowerCase()}@${safeName}.com`,
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
  @FakeMeUsing(() => generateFake(ResourceClaimDto, undefined, faker.datatype.number(5)))
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
  @FakeMeUsing(() => faker.datatype.number(999999))
  applicationId: number;
  @Expose()
  @FakeMeUsing(() => faker.commerce.department() + ' ' + faker.company.catchPhraseNoun())
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
