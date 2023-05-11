import { FakeMeUsing, generateFake } from "@edanalytics/utils";
import { faker } from "@faker-js/faker";
import { Expose } from "class-transformer";
import { makeSerializer } from "../utils/make-serializer";

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
  const companyName = faker.company.name()
  const safeName = companyName.replace(/[^\w]+/g, '-').toLowerCase()
  const contactName = faker.name.fullName()
  return {
    vendorId: faker.datatype.number(999999),
    company: companyName,
    namespacePrefixes: `@${safeName}`,
    contactName: contactName,
    contactEmailAddress: `${contactName.replace(/\s+/g, '.').toLowerCase()}@${safeName}.com`
  }
})
export class GetVendorDto extends PostVendorDto {
  @Expose()
  vendorId: number;

  get id() {
    return this.vendorId
  }

  get displayName() {
    return this.company
  }
}
export class PutVendorDto extends GetVendorDto { }
export const toGetVendorDto = makeSerializer(GetVendorDto)

class AuthStrategyDto {
  authStrategyName: string;
  isInheritedFromParent: boolean;
}

class ResourceClaimDto {
  @FakeMeUsing(faker.internet.domainWord)
  name: string;
  @FakeMeUsing(faker.datatype.boolean)
  read: boolean;
  @FakeMeUsing(faker.datatype.boolean)
  create: boolean;
  @FakeMeUsing(faker.datatype.boolean)
  update: boolean;
  @FakeMeUsing(faker.datatype.boolean)
  delete: boolean;
  @FakeMeUsing(() => [])
  defaultAuthStrategiesForCRUD: AuthStrategyDto[];
  @FakeMeUsing(() => [])
  authStrategyOverridesForCRUD: AuthStrategyDto[];
  @FakeMeUsing(() => [])
  children: ResourceClaimDto[]
}

export class PostClaimsetDto {
  @FakeMeUsing(() => faker.helpers.arrayElement(['sis', 'sis - on-prem', 'assessment']) + '-' + faker.datatype.number(10))
  name: string;
  @FakeMeUsing(() => generateFake(ResourceClaimDto, undefined, faker.datatype.number(5)))
  resourceClaims: ResourceClaimDto[]
}

export class PutClaimsetDto extends PostClaimsetDto {
  @FakeMeUsing(() => faker.datatype.number(999999))
  id: number;
}
export class GetClaimsetDto extends PutClaimsetDto {
  @FakeMeUsing(faker.datatype.boolean)
  isSystemReserved: boolean;
  @FakeMeUsing(0)
  applicationsCount: number;

  get displayName() {
    return this.name
  }
}
export const toGetClaimsetDto = makeSerializer(GetClaimsetDto)

export class PostApplicationDto {
  applicationName: string;
  vendorId: string;
  claimSetName: string;
  profileId: number;
  educationOrganizationIds: number[];
}

export class PostApplicationResponseDto {
  applicationId: number;
  key: string;
  secret: string;
}

export class PutApplicationDto extends PostApplicationDto {
  applicationId: number;
}

export class ApplicationResetCredentialResponseDto {
  applicationId: number;
  key: string;
  secret: string;
}

export class GetApplicationDto {
  @FakeMeUsing(() => faker.datatype.number(999999))
  applicationId: number;
  @FakeMeUsing(() => faker.commerce.department() + ' ' + faker.company.catchPhraseNoun())
  applicationName: string;
  claimSetName: string;
  @FakeMeUsing('default')
  profileName: string;
  educationOrganizationId: number;
  odsInstanceName: string;

  get displayName() {
    return this.applicationName
  }

  get id() {
    return this.applicationId
  }
}

export const toGetApplicationDto = makeSerializer(GetApplicationDto)