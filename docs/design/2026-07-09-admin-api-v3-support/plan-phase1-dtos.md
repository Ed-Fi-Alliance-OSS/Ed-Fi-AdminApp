# Phase 1: V3 DTOs

> Part of [`plan.md`](./plan.md). Read that file first for Goal/Architecture/Global Constraints.

**Files:**
- Create: `packages/models/src/dtos/edfi-admin-api.v3.dto.ts`
- Modify: `packages/models/src/dtos/index.ts`
- Modify: `packages/models/src/dtos/edfi-admin-api.v3.dto.spec.ts` (create)

**Interfaces:**
- Consumes: shared base DTOs from `packages/models/src/dtos/edfi-admin-api.dto.ts` — `PostVendorDto`, `PostApplicationDtoBase`, `PostApplicationFormBase`, `PostApiClientResponseDtoBase`, `PostApplicationResponseDtoBase` (unchanged, version-agnostic).
- Produces: all V3 DTO classes and `toGet*DtoV3` serializer consts listed below. Phase 3 (service) and Phase 4 (controller) import these by exact name.

There is no existing test file for `edfi-admin-api.v2.dto.ts` (DTOs in this codebase are declarative classes with `class-validator`/`class-transformer` decorators and are exercised indirectly through controller/service specs, not unit-tested standalone). This phase therefore adds one small spec file that verifies the file compiles and a representative serializer round-trips correctly, then relies on `nx run models:build` (TypeScript compilation) as the primary correctness check — this mirrors how the codebase already treats DTO files.

### Task 1: Create `edfi-admin-api.v3.dto.ts`

- [ ] **Step 1: Create the file with the full V3 DTO set**

Create `packages/models/src/dtos/edfi-admin-api.v3.dto.ts` with this exact content (this is a rename-only duplicate of `edfi-admin-api.v2.dto.ts`: suffix `V2`→`V3`, identifier segment `OdsInstance`→`DataStore`, field `odsInstanceId(s)`→`dataStoreId(s)`, field `instanceType`→`dataStoreType`; `StartingBlocksServiceV2`/`ISbEnvironmentConfigPrivateV2` are unrelated to this file and not touched anywhere in this plan):

```typescript
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
  dataStoreIds: number[];

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
  dataStoreIds: number[];
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
  dataStoreIds: number[];
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
  dataStoreId: number;
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
  dataStoreId: number;

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
  dataStoreIds: number[];

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
  dataStoreIds: number[];

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
  dataStoreId: number;

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

export class GetDataStoreSummaryDtoV3 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  dataStoreType: string;
}

export const toGetDataStoreSummaryDtoV3 = makeSerializer(GetDataStoreSummaryDtoV3);

export class PostCreateDataStoreDtoV3 {
  @Expose()
  @IsString()
  @TrimWhitespace()
  name: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  dataStoreType: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  connectionString: string;
}

export class GetDataStoreDetailDtoV3 {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  dataStoreType: string;

  @Expose()
  @Type(() => GetDataStoreContextDtoV3)
  dataStoreContexts: GetDataStoreContextDtoV3[];

  @Expose()
  @Type(() => GetDataStoreDerivativeDtoV3)
  dataStoreDerivatives: GetDataStoreDerivativeDtoV3[];
}
export class PostDataStoreContextDtoV3 {
  @Expose()
  @IsNumber()
  dataStoreId: number;

  @Expose()
  @IsString()
  @TrimWhitespace()
  contextKey: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  contextValue: string;
}

export class PutDataStoreContextDtoV3 extends PostDataStoreContextDtoV3 {}

export class GetDataStoreContextDtoV3 extends PostDataStoreContextDtoV3 {
  @Expose()
  id: number;
}

export const toGetDataStoreContextDtoV3 = makeSerializer(GetDataStoreContextDtoV3);

export class DataStoreDerivativeDtoBase {
  @IsNumber()
  @Expose()
  dataStoreId: number;

  @IsString()
  @Expose()
  derivativeType: string;
}

export class GetDataStoreDerivativeDtoV3 extends DataStoreDerivativeDtoBase {
  @Expose()
  id: number;
}
export const toGetDataStoreDerivativeDtoV3 = makeSerializer(GetDataStoreDerivativeDtoV3);

export class PutDataStoreDerivativeDtoV3 extends DataStoreDerivativeDtoBase {
  @Expose()
  @IsString()
  @TrimWhitespace()
  connectionString: string;
}
export class PostDataStoreDerivativeDtoV3 extends PutDataStoreDerivativeDtoV3 {}
export class PutDataStoreDtoV3 extends PutDataStoreDerivativeDtoV3 {}
export class PostDataStoreDtoV3 extends PutDataStoreDerivativeDtoV3 {}

export const toGetDataStoreDetailDtoV3 = makeSerializer(GetDataStoreDetailDtoV3);

export class PutUpdateDataStoreDtoV3 {
  @Expose()
  @IsString()
  @TrimWhitespace()
  name: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  dataStoreType: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  connectionString: string;
}

export class GetApplicationAssignedToDataStoreDtoV3 {
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
  dataStoreId: number;
}

export const toGetApplicationAssignedToDataStoreDtoV3 = makeSerializer(
  GetApplicationAssignedToDataStoreDtoV3
);

export class PutUpdateDataStoreContextDtoV3 extends PostDataStoreContextDtoV3 {}

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
```

- [ ] **Step 2: Register the barrel export**

Edit `packages/models/src/dtos/index.ts`. It currently looks like this:

```typescript
export * from './edfi-admin-api.dto';
export * from './edfi-admin-api.v2.dto';
```

(exact existing lines may include others — locate the `edfi-admin-api.v2.dto` export line and add a new line directly after it)

```typescript
export * from './edfi-admin-api.dto';
export * from './edfi-admin-api.v2.dto';
export * from './edfi-admin-api.v3.dto';
```

- [ ] **Step 3: Write a spec verifying the new DTOs compile and serialize correctly**

Create `packages/models/src/dtos/edfi-admin-api.v3.dto.spec.ts`:

```typescript
import {
  GetApiClientDtoV3,
  GetDataStoreDetailDtoV3,
  GetDataStoreSummaryDtoV3,
  toGetApiClientDtoV3,
  toGetDataStoreDetailDtoV3,
  toGetDataStoreSummaryDtoV3,
} from './edfi-admin-api.v3.dto';

describe('edfi-admin-api.v3.dto', () => {
  it('serializes GetDataStoreSummaryDtoV3 using dataStoreType (not instanceType)', () => {
    const raw = { id: 1, name: 'Ods1', dataStoreType: 'Ods' };
    const result = toGetDataStoreSummaryDtoV3(raw);

    expect(result).toBeInstanceOf(GetDataStoreSummaryDtoV3);
    expect(result.dataStoreType).toBe('Ods');
  });

  it('serializes GetApiClientDtoV3 using dataStoreIds (not odsInstanceIds)', () => {
    const raw = {
      id: 1,
      name: 'client',
      key: 'key',
      isApproved: true,
      useSandbox: false,
      sandboxType: 0,
      applicationId: 2,
      keyStatus: 'Active',
      dataStoreIds: [10, 20],
    };
    const result = toGetApiClientDtoV3(raw);

    expect(result).toBeInstanceOf(GetApiClientDtoV3);
    expect(result.dataStoreIds).toEqual([10, 20]);
    expect(result.displayName).toBe('client');
  });

  it('serializes nested GetDataStoreDetailDtoV3 contexts/derivatives under renamed keys', () => {
    const raw = {
      id: 1,
      name: 'Ods1',
      dataStoreType: 'Ods',
      dataStoreContexts: [{ id: 5, dataStoreId: 1, contextKey: 'k', contextValue: 'v' }],
      dataStoreDerivatives: [{ id: 6, dataStoreId: 1, derivativeType: 'ReadReplica' }],
    };
    const result = toGetDataStoreDetailDtoV3(raw);

    expect(result).toBeInstanceOf(GetDataStoreDetailDtoV3);
    expect(result.dataStoreContexts[0].dataStoreId).toBe(1);
    expect(result.dataStoreDerivatives[0].derivativeType).toBe('ReadReplica');
  });
});
```

- [ ] **Step 4: Run the new spec to verify it passes**

Run: `npx nx test models --testFile=edfi-admin-api.v3.dto.spec.ts`
Expected: 3 passing tests, 0 failures. (There is no prior "failing" step here since this is a pure-addition spec for a brand-new file — nothing to regress.)

- [ ] **Step 5: Build the models package to catch any type errors across the whole package**

Run: `npx nx build models`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add packages/models/src/dtos/edfi-admin-api.v3.dto.ts packages/models/src/dtos/edfi-admin-api.v3.dto.spec.ts packages/models/src/dtos/index.ts
git commit -m "feat: add Admin API V3 DTOs"
```

Next: [`plan-phase2-exception-filter.md`](./plan-phase2-exception-filter.md)
