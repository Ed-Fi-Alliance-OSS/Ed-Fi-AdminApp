import { Link, Text } from '@chakra-ui/react';
import { GetOdsDto } from '@edanalytics/models';
import { UseQueryResult } from '@tanstack/react-query';
import { Route, Link as RouterLink, useParams } from '@tanstack/router';
import { asRoute, sbeRoute } from '.';
import { OdsPage } from '../Pages/Ods/OdsPage';
import { OdssPage } from '../Pages/Ods/OdssPage';
import { odsQueries } from '../api';
import { getRelationDisplayName } from '../helpers';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

export const odssRoute = new Route({
  getParentRoute: () => sbeRoute,
  path: 'odss',
  getContext: ({ params }) => ({
    breadcrumb: () => ({ title: () => 'Odss', params }),
  }),
});

export const odssIndexRoute = new Route({
  getParentRoute: () => odssRoute,
  path: '/',
  component: OdssPage,
});

const OdsBreadcrumb = () => {
  const params = useParams({ from: odsRoute.id });
  const ods = odsQueries.useOne({
    id: params.odsId,
    tenantId: params.asId,
    sbeId: params.sbeId,
  });
  return ods.data?.displayName ?? params.odsId;
};

export const odsRoute = new Route({
  getParentRoute: () => odssRoute,
  path: '$odsId',
  validateSearch: (search): { edit?: boolean } =>
    typeof search.edit === 'boolean' ? { edit: search.edit } : {},
  getContext: ({ params }) => {
    return {
      breadcrumb: () => ({ title: OdsBreadcrumb, params }),
    };
  },
});

export const odsIndexRoute = new Route({
  getParentRoute: () => odsRoute,
  path: '/',
  component: OdsPage,
});

export const OdsLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetOdsDto>, unknown>;
}) => {
  const ods = getEntityFromQuery(props.id, props.query);
  const params = useParams({ from: asRoute.id });
  return ods ? (
    <Link as="span">
      <RouterLink
        title="Go to ods"
        to={odsRoute.fullPath}
        params={{
          asId: params.asId,
          sbeId: String(ods.sbeId),
          odsId: String(props.id),
        }}
      >
        {getRelationDisplayName(ods.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Ods may have been deleted." as="i" color="gray.500">
      not found
    </Text>
  ) : null;
};
