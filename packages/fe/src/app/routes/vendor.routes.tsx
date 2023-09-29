import { Link, Text } from '@chakra-ui/react';
import { GetVendorDto } from '@edanalytics/models';
import { UseQueryResult } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router-dom';
import { VendorPage } from '../Pages/Vendor/VendorPage';
import { VendorsPage } from '../Pages/Vendor/VendorsPage';
import { vendorQueries } from '../api';
import { getRelationDisplayName, useNavContext } from '../helpers';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';
import { CreateVendor } from '../Pages/Vendor/CreateVendorPage';

const VendorBreadcrumb = () => {
  const params = useParams() as {
    vendorId: string;
    asId: string;
    sbeId: string;
  };
  const vendor = vendorQueries.useOne({
    id: params.vendorId,
    tenantId: params.asId,
    sbeId: params.sbeId,
  });
  return vendor.data?.displayName ?? params.vendorId;
};
export const vendorCreateRoute: RouteObject = {
  path: '/as/:asId/sbes/:sbeId/vendors/create',
  element: <CreateVendor />,
  handle: { crumb: () => 'Create Vendor' },
};
export const vendorIndexRoute: RouteObject = {
  path: '/as/:asId/sbes/:sbeId/vendors/:vendorId/',
  element: <VendorPage />,
};

export const vendorRoute: RouteObject = {
  path: '/as/:asId/sbes/:sbeId/vendors/:vendorId',
  handle: { crumb: VendorBreadcrumb, fallbackCrumb: () => 'Vendor' },
};
export const vendorsIndexRoute: RouteObject = {
  path: '/as/:asId/sbes/:sbeId/vendors/',
  element: <VendorsPage />,
};
export const vendorsRoute: RouteObject = {
  path: '/as/:asId/sbes/:sbeId/vendors',
  handle: { crumb: () => 'Vendors' },
};

export const VendorLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetVendorDto>, unknown>;
}) => {
  const vendor = getEntityFromQuery(props.id, props.query);
  const navContext = useNavContext();
  const sbeId = navContext.sbeId!;
  const asId = navContext.asId!;

  return vendor ? (
    <Link as="span">
      <RouterLink title="Go to vendor" to={`/as/${asId}/sbes/${sbeId}/vendors/${vendor.id}`}>
        {getRelationDisplayName(vendor.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Vendor may have been deleted." as="i" color="gray.500">
      not found
    </Text>
  ) : null;
};
