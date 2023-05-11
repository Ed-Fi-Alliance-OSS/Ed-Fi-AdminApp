import { Link, Text } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, Route, useParams } from '@tanstack/router';
import { UseQueryResult } from '@tanstack/react-query';
import { GetVendorDto } from '@edanalytics/models';
import { mainLayoutRoute, sbeRoute } from '.';
import { getRelationDisplayName } from '../helpers';
import { vendorQueries } from '../api';
import { VendorPage } from '../Pages/Vendor/VendorPage';
import { VendorsPage } from '../Pages/Vendor/VendorsPage';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

export const vendorsRoute = new Route({
  getParentRoute: () => sbeRoute,
  path: 'vendors',
  getContext: ({ params }) => ({
    breadcrumb: () => ({ title: () => 'Vendors', params }),
  }),
});

export const vendorsIndexRoute = new Route({
  getParentRoute: () => vendorsRoute,
  path: '/',
  component: VendorsPage,
});

const VendorBreadcrumb = () => {
  const params = useParams({ from: vendorRoute.id });
  const vendor = vendorQueries.useOne({
    tenantId: params.asId,
    sbeId: params.sbeId,
    id: params.vendorId,
  });
  return vendor.data?.company ?? params.vendorId;
};

export const vendorRoute = new Route({
  getParentRoute: () => vendorsRoute,
  path: '$vendorId',
  validateSearch: (search): { edit?: boolean } =>
    typeof search.edit === 'boolean' ? { edit: search.edit } : {},
  getContext: ({ params }) => {
    return {
      breadcrumb: () => ({ title: VendorBreadcrumb, params }),
    };
  },
});

export const vendorIndexRoute = new Route({
  getParentRoute: () => vendorRoute,
  path: '/',
  component: VendorPage,
});

export const VendorLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetVendorDto>, unknown>;
  sbeId: string;
}) => {
  const vendor = getEntityFromQuery(props.id, props.query);
  return vendor ? (
    <Link as="span">
      <RouterLink
        title="Go to vendor"
        to={vendorRoute.fullPath}
        params={(previous: any) => ({
          ...previous,
          vendorId: String(vendor.vendorId),
          sbeId: props.sbeId,
        })}
      >
        {getRelationDisplayName(vendor.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Vendor may have been deleted." as="i" color="gray.500">
      not found
    </Text>
  ) : null;
};
