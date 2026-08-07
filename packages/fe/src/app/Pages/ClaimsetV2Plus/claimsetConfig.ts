import {
  CopyClaimsetDtoV2,
  CopyClaimsetDtoV3,
  GetClaimsetMultipleDtoV2,
  GetClaimsetMultipleDtoV3,
} from '@edanalytics/models';
import { claimsetQueriesV2, claimsetQueriesV3 } from '../../api';
import { createVersionedResource } from '../../api/queries/versioned';

export type ClaimsetEntity = GetClaimsetMultipleDtoV2 | GetClaimsetMultipleDtoV3;

// A true discriminated union: each branch ties `version` to the matching
// `queries`/`CopyDto`. See vendorConfig.ts/profileConfig.ts and
// 527-design.md section 1 for the full rationale. Unlike Vendor/Profile,
// there's no Post/PutDto pair here — Create/Edit aren't implemented for
// Claimset in either version (see 530-design.md's scope boundaries).
export type ClaimsetConfig =
  | {
      version: 'v2';
      queries: typeof claimsetQueriesV2;
      CopyDto: typeof CopyClaimsetDtoV2;
    }
  | {
      version: 'v3';
      queries: typeof claimsetQueriesV3;
      CopyDto: typeof CopyClaimsetDtoV3;
    };

// Do NOT add an explicit `: () => ClaimsetConfig` return-type annotation
// here. It silently erases the `.match` static property
// `createVersionedResource` attaches to the returned function — every
// `.match()` call site would still type-check, but fail at runtime, with no
// compile error pointing back here.
export const useClaimsetConfig = createVersionedResource<ClaimsetConfig>({
  v2: {
    version: 'v2',
    queries: claimsetQueriesV2,
    CopyDto: CopyClaimsetDtoV2,
  },
  v3: {
    version: 'v3',
    queries: claimsetQueriesV3,
    CopyDto: CopyClaimsetDtoV3,
  },
});
