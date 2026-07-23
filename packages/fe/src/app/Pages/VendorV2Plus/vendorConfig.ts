import {
  GetVendorDtoV2,
  GetVendorDtoV3,
  PostVendorDtoV2,
  PostVendorDtoV3,
  PutVendorDtoV2,
  PutVendorDtoV3,
} from '@edanalytics/models';
import { vendorQueriesV2, vendorQueriesV3 } from '../../api';
import { createVersionedResource } from '../../api/queries/versioned';

export type VendorEntity = GetVendorDtoV2 | GetVendorDtoV3;

// A true discriminated union: each branch ties `version` to the matching
// `queries`/`PostDto`/`PutDto` set, so the two branches can't mix-and-match
// members from each other.
export type VendorConfig =
  | {
      version: 'v2';
      queries: typeof vendorQueriesV2;
      PostDto: typeof PostVendorDtoV2;
      PutDto: typeof PutVendorDtoV2;
    }
  | {
      version: 'v3';
      queries: typeof vendorQueriesV3;
      PostDto: typeof PostVendorDtoV3;
      PutDto: typeof PutVendorDtoV3;
    };

export const useVendorConfig: () => VendorConfig = createVersionedResource<VendorConfig>({
  v2: {
    version: 'v2',
    queries: vendorQueriesV2,
    PostDto: PostVendorDtoV2,
    PutDto: PutVendorDtoV2,
  },
  v3: {
    version: 'v3',
    queries: vendorQueriesV3,
    PostDto: PostVendorDtoV3,
    PutDto: PutVendorDtoV3,
  },
});
