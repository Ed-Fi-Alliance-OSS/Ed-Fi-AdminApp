import { Expose, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsNotEmpty,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { sanitizeForUrl, trimTrailingSlashes } from '@edanalytics/utils';
import { TrimWhitespace } from '../utils';
import { makeSerializer } from '../utils/make-serializer';
import {
  PostApiClientResponseDtoBase,
  PostApplicationDtoBase,
  PostApplicationFormBase,
  PostApplicationResponseDtoBase,
  PostVendorDto,
} from './edfi-admin-api.dto';

export class PostVendorDtoV3 extends PostVendorDto {}

export class GetVendorDtoV3 extends PostVendorDtoV3 {
  @Expose()
  @IsNumber()
  id: number;

  get displayName() {
    return this.company;
  }
}
export class PutVendorDtoV3 extends GetVendorDtoV3 {}
export const toGetVendorDtoV3 = makeSerializer(GetVendorDtoV3);

export class GetProfileDtoV3 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  definition?: string | undefined;

  get displayName() {
    return this.name;
  }
}

export class PostProfileDtoV3 {
  @Expose()
  @IsNotEmpty()
  @TrimWhitespace()
  name: string;

  @Expose()
  @IsString()
  @IsNotEmpty()
  @TrimWhitespace()
  definition: string;
}

export class PutProfileDtoV3 extends PostProfileDtoV3 {
  id: number;
}

export const toGetProfileDtoV3 = makeSerializer(GetProfileDtoV3);

export class GetActionDtoV3 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  uri: string;
}

export const toGetActionDtoV3 = makeSerializer(GetActionDtoV3);

export class GetApiClientDtoV3 {
  @Expose()
  id: number;
  @Expose()
  name: string;
  @Expose()
  key: string;
  @Expose()
  isApproved: boolean;
  @Expose()
  useSandbox: boolean;
  @Expose()
  sandboxType: number;
  @Expose()
  applicationId: number;
  @Expose()
  keyStatus: string;
  @Expose()
  odsInstanceIds: number[];

  get displayName() {
    return this.name;
  }

  static apiUrl(startingBlocks: boolean, domain: string, apiClientName: string, tenantName: string) {
    const url = new URL(domain);
    url.protocol = 'https:';
    if (startingBlocks)
    {
      const appName = sanitizeForUrl(apiClientName).slice(0, 40);
      const pathname = trimTrailingSlashes(url.pathname);

      url.pathname = `${pathname}/${tenantName}`;
      url.hostname = `${appName}.${url.hostname}`;
    }
    return url.toString();
  }
}

export class PostApiClientDtoV3 {
  @Expose()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @Expose()
  @IsBoolean()
  isApproved: boolean;

  @Expose()
  @IsNumber()
  applicationId: number;

  @Expose()
  @IsNumber(undefined, { each: true })
  @ArrayNotEmpty()
  odsInstanceIds: number[];
}

export class PutApiClientDtoV3 {
  @Expose()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @Expose()
  @IsBoolean()
  isApproved: boolean;

  @Expose()
  @IsNumber()
  id: number;

  @Expose()
  @IsNumber()
  applicationId: number;

  @Expose()
  @IsNumber(undefined, { each: true })
  @ArrayNotEmpty()
  odsInstanceIds: number[];
}

export class PostApiClientResponseDtoV3 extends PostApiClientResponseDtoBase {
  @Expose()
  id: number;
}

export class PostApiClientFormDtoV3 {
  @Expose()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @Expose()
  @IsBoolean()
  isApproved: boolean;

  @Expose()
  @IsNumber()
  applicationId: number;
  
  @Expose()
  @IsNumber()
  odsInstanceId: number;
}

export class PutApiClientFormDtoV3 {
  @Expose()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @Expose()
  @IsBoolean()
  isApproved: boolean;

  @Expose()
  @IsNumber()
  odsInstanceId: number;

  @Expose()
  @IsNumber()
  id: number;

  @Expose()
  @IsNumber()
  applicationId: number;
}

export const toGetApiClientDtoV3 = makeSerializer(GetApiClientDtoV3);

export const toPostApiClientResponseDtoV3 = makeSerializer(PostApiClientResponseDtoV3);

export class GetApplicationDtoV3 {
  @Expose()
  id: number;
  @Expose()
  applicationName: string;
  @Expose()
  vendorId: number;
  @Expose()
  claimSetName: string;
  @Expose()
  profileIds: GetProfileDtoV3['id'][];
  @Expose()
  educationOrganizationIds: number[];
  @Expose()
  odsInstanceIds: number[];

  get displayName() {
    return this.applicationName;
  }

  static apiUrl(startingBlocks: boolean, domain: string, applicationName: string, tenantName: string) {
    const url = new URL(domain);
    url.protocol = 'https:';
    if (startingBlocks)
    {
      const appName = sanitizeForUrl(applicationName).slice(0, 40);
      const pathname = trimTrailingSlashes(url.pathname);

      url.pathname = `${pathname}/${tenantName}`;
      url.hostname = `${appName}.${url.hostname}`;
    }
    return url.toString();
  }
}

export const toGetApplicationDtoV3 = makeSerializer(GetApplicationDtoV3);
export class PostApplicationDtoV3 extends PostApplicationDtoBase {
  @Expose()
  @IsOptional()
  @IsNumber(undefined, { each: true })
  profileIds: number[];

  @Expose()
  @IsNumber(undefined, { each: true })
  educationOrganizationIds: number[];

  @Expose()
  @IsNumber()
  odsInstanceIds: number[];

  @Expose()
  @IsNumber()
  integrationProviderId: number;
}
export class PutApplicationDtoV3 extends PostApplicationDtoV3 {}

export class PostApplicationFormDtoV3 extends PostApplicationFormBase {
  @Expose()
  @IsOptional()
  @IsNumber(undefined, { each: true })
  profileIds?: number[];

  @Expose()
  @IsNumber(undefined, { each: true })
  @ArrayNotEmpty()
  educationOrganizationIds: number[];

  @Expose()
  @IsNumber()
  odsInstanceId: number;

  @Expose()
  @IsNumber()
  @IsOptional()
  integrationProviderId?: number;
}

export class PutApplicationFormDtoV3 extends PostApplicationFormDtoV3 {
  id: number;
}

export class PostApplicationResponseDtoV3 extends PostApplicationResponseDtoBase {
  @Expose()
  id: number;
}

export const toPostApplicationResponseDtoV3 = makeSerializer(PostApplicationResponseDtoV3);

export class GetAuthStrategyDtoV3 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  displayName: string;
}

export const toGetAuthStrategyDtoV3 = makeSerializer(GetAuthStrategyDtoV3);

export class GetClaimsetMultipleDtoV3 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  _isSystemReserved: boolean;

  @Expose()
  _applications: GetApplicationDtoV3[];

  get applicationsCount() {
    return this._applications.length;
  }

  get displayName() {
    return this.name;
  }
}

export const toGetClaimsetMultipleDtoV3 = makeSerializer(GetClaimsetMultipleDtoV3);

export class GetClaimsetSingleDtoV3 extends GetClaimsetMultipleDtoV3 {
  @Expose()
  @Type(() => GetResourceClaimDtoV3)
  resourceClaims: GetResourceClaimDtoV3[];
}

export const toGetClaimsetSingleDtoV3 = makeSerializer(GetClaimsetSingleDtoV3);

export class ImportClaimsetSingleDtoV3 {
  @Expose()
  @TrimWhitespace()
  name: string;

  @Expose()
  @Type(() => ResourceClaimDtoV3)
  resourceClaims: ResourceClaimDtoV3[];
}
export const toImportClaimsetSingleDtoV3 = makeSerializer(ImportClaimsetSingleDtoV3);

export class ResourceClaimDtoV3 {
  @Expose()
  id: string;

  @Expose()
  @TrimWhitespace()
  name: string;

  @Expose()
  @Type(() => ClaimsetResourceClaimActionDtoV3)
  actions: ClaimsetResourceClaimActionDtoV3[];

  @Expose()
  @Type(() => ClaimsetActionAuthStrategyDtoV3)
  authorizationStrategyOverridesForCRUD: ClaimsetActionAuthStrategyDtoV3[];

  @Expose()
  @Type(() => GetResourceClaimDtoV3)
  children: GetResourceClaimDtoV3[];
}

export class GetResourceClaimDtoV3 extends ResourceClaimDtoV3 {
  @Expose()
  @Type(() => ClaimsetActionAuthStrategyDtoV3)
  _defaultAuthorizationStrategiesForCRUD: ClaimsetActionAuthStrategyDtoV3[];
}
export class ClaimsetResourceClaimActionDtoV3 {
  @Expose()
  name: string;

  @Expose()
  enabled: boolean;
}

export class ClaimsetActionAuthStrategyDtoV3 {
  @Expose()
  actionId: number;

  @Expose()
  actionName: string;

  @Expose()
  @Type(() => ClaimsetAuthStrategyDtoV3)
  authorizationStrategies: ClaimsetAuthStrategyDtoV3[];
}

export class ClaimsetAuthStrategyDtoV3 {
  @Expose()
  authStrategyId: number;

  @Expose()
  authStrategyName: string;

  @Expose()
  isInheritedFromParent: boolean;
}

export class PutClaimsetDtoV3 {
  @Expose()
  @IsString()
  @MinLength(1)
  name: string;
}

export class PostClaimsetDtoV3 extends PutClaimsetDtoV3 {}

export class PutClaimsetFormDtoV3 extends PutClaimsetDtoV3 {
  id: number;
}

export class PutClaimsetResourceClaimActionsDtoV3 {
  @Expose()
  @Type(() => ClaimsetResourceClaimActionDtoV3)
  @ValidateNested({ each: true })
  resourceClaimActions: ClaimsetResourceClaimActionDtoV3[];
}

export class PostClaimsetResourceClaimActionsDtoV3 extends PutClaimsetResourceClaimActionsDtoV3 {
  @Expose()
  @IsNumber()
  resourceClaimId: number;
}

export class PostActionAuthStrategiesDtoV3 {
  @Expose()
  @IsNumber()
  actionName: number;

  @Expose()
  @IsString({ each: true })
  authorizationStrategies: string[];
}

export class CopyClaimsetDtoV3 {
  @Expose()
  @IsNumber()
  originalId: number;

  @Expose()
  @IsString()
  @TrimWhitespace()
  name: string;
}

// Just calling out there's no need for the below. The UX wouldn't benefit from it. We let Admin API do the validation and just pass on whatever it says.
// export class ImportClaimsetDtoV3 {}

export class GetOdsInstanceSummaryDtoV3 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  instanceType: string;
}

export const toGetOdsInstanceSummaryDtoV3 = makeSerializer(GetOdsInstanceSummaryDtoV3);

export class PostCreateOdsInstanceDtoV3 {
  @Expose()
  @IsString()
  @TrimWhitespace()
  name: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  instanceType: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  connectionString: string;
}

export class GetOdsInstanceDetailDtoV3 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  instanceType: string;

  @Expose()
  @Type(() => GetOdsInstanceContextDtoV3)
  odsInstanceContexts: GetOdsInstanceContextDtoV3[];

  @Expose()
  @Type(() => GetOdsInstanceDerivativeDtoV3)
  odsInstanceDerivatives: GetOdsInstanceDerivativeDtoV3[];
}
export class PostOdsInstanceContextDtoV3 {
  @Expose()
  @IsNumber()
  odsInstanceId: number;

  @Expose()
  @IsString()
  @TrimWhitespace()
  contextKey: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  contextValue: string;
}

export class PutOdsInstanceContextDtoV3 extends PostOdsInstanceContextDtoV3 {}

export class GetOdsInstanceContextDtoV3 extends PostOdsInstanceContextDtoV3 {
  @Expose()
  id: number;
}

export const toGetOdsInstanceContextDtoV3 = makeSerializer(GetOdsInstanceContextDtoV3);

export class OdsInstanceDerivativeDtoBaseV3 {
  @IsNumber()
  @Expose()
  odsInstanceId: number;

  @IsString()
  @Expose()
  derivativeType: string;
}

export class GetOdsInstanceDerivativeDtoV3 extends OdsInstanceDerivativeDtoBaseV3 {
  @Expose()
  id: number;
}
export const toGetOdsInstanceDerivativeDtoV3 = makeSerializer(GetOdsInstanceDerivativeDtoV3);

export class PutOdsInstanceDerivativeDtoV3 extends OdsInstanceDerivativeDtoBaseV3 {
  @Expose()
  @IsString()
  @TrimWhitespace()
  connectionString: string;
}
export class PostOdsInstanceDerivativeDtoV3 extends PutOdsInstanceDerivativeDtoV3 {}
export class PutOdsInstanceDtoV3 extends PutOdsInstanceDerivativeDtoV3 {}
export class PostOdsInstanceDtoV3 extends PutOdsInstanceDerivativeDtoV3 {}

export const toGetOdsInstanceDetailDtoV3 = makeSerializer(GetOdsInstanceDetailDtoV3);

export class PutUpdateOdsInstanceDtoV3 {
  @Expose()
  @IsString()
  @TrimWhitespace()
  name: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  instanceType: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  connectionString: string;
}

export class GetApplicationAssignedToOdsInstanceDtoV3 {
  @Expose()
  id: number;

  @Expose()
  applicationName: string;

  @Expose()
  vendorId: number;

  @Expose()
  claimSetName: string;

  @Expose()
  profileIds: number[];

  @Expose()
  educationOrganizationIds: number[];

  @Expose()
  odsInstanceId: number;
}

export const toGetApplicationAssignedToOdsInstanceDtoV3 = makeSerializer(
  GetApplicationAssignedToOdsInstanceDtoV3
);

export class PutUpdateOdsInstanceContextDtoV3 extends PostOdsInstanceContextDtoV3 {}

export class GetResourceClaimDetailDtoV3 {
  @Expose()
  id: number;

  @Expose()
  @IsString()
  name: string;

  @Expose()
  parentId: number | null;

  @Expose()
  @IsString()
  parentName: string;

  @Expose()
  @Type(() => GetResourceClaimDetailDtoV3)
  children: GetResourceClaimDetailDtoV3[];
}

export const toGetResourceClaimDetailDtoV3 = makeSerializer(GetResourceClaimDetailDtoV3);

