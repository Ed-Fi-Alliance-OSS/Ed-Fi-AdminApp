import { Link, Text } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, Route, useParams } from '@tanstack/router';
import { UseQueryResult } from '@tanstack/react-query';
import { GetTenantDto } from '@edanalytics/models';
import { mainLayoutRoute } from '.';
import { getRelationDisplayName } from '../helpers';
import { tenantQueries } from '../api';
import { TenantPage } from '../Pages/Tenant/TenantPage';
import { TenantsPage } from '../Pages/Tenant/TenantsPage';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

export const tenantsRoute = new Route({
  getParentRoute: () => mainLayoutRoute,
  path: 'tenants',
  getContext: ({ params }) => ({
    breadcrumb: () => ({ title: () => 'Tenants', params }),
  }),
});

export const tenantsIndexRoute = new Route({
  getParentRoute: () => tenantsRoute,
  path: '/',
  component: TenantsPage,
});

const TenantBreadcrumb = () => {
  const params = useParams({ from: tenantRoute.id });
  const tenant = tenantQueries.useOne({
    id: params.tenantId,
  });
  return tenant.data?.displayName ?? params.tenantId;
};

export const tenantRoute = new Route({
  getParentRoute: () => tenantsRoute,
  path: '$tenantId',
  validateSearch: (search): { edit?: boolean } =>
    typeof search.edit === 'boolean' ? { edit: search.edit } : {},
  getContext: ({ params }) => {
    return {
      breadcrumb: () => ({ title: TenantBreadcrumb, params }),
    };
  },
});

export const tenantIndexRoute = new Route({
  getParentRoute: () => tenantRoute,
  path: '/',
  component: TenantPage,
});

export const TenantLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetTenantDto>, unknown>;
}) => {
  const tenant = getEntityFromQuery(props.id, props.query);
  return tenant ? (
    <Link as="span">
      <RouterLink
        title="Go to tenant"
        to={tenantRoute.fullPath}
        params={{
          tenantId: String(tenant.id),
        }}
      >
        {getRelationDisplayName(tenant.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Tenant may have been deleted." as="i" color="gray.500">
      not found
    </Text>
  ) : null;
};
