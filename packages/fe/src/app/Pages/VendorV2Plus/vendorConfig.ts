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

export const useVendorConfig = createVersionedResource({
  v2: {
    version: 'v2' as const,
    queries: vendorQueriesV2,
    PostDto: PostVendorDtoV2,
    PutDto: PutVendorDtoV2,
  },
  v3: {
    version: 'v3' as const,
    queries: vendorQueriesV3,
    PostDto: PostVendorDtoV3,
    PutDto: PutVendorDtoV3,
  },
});
