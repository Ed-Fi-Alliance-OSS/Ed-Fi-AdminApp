import { Link, Text } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, Route, useParams } from '@tanstack/router';
import { UseQueryResult } from '@tanstack/react-query';
import { GetSbeDto } from '@edanalytics/models';
import { asRoute, mainLayoutRoute } from '.';
import { getRelationDisplayName } from '../helpers';
import { sbeQueries } from '../api';
import { SbePage } from '../Pages/Sbe/SbePage';
import { SbesPage } from '../Pages/Sbe/SbesPage';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

export const sbesRoute = new Route({
  getParentRoute: () => asRoute,
  path: 'sbes',
  getContext: ({ params }) => ({
    breadcrumb: () => ({ title: () => 'Sbes', params }),
  }),
});

export const sbesIndexRoute = new Route({
  getParentRoute: () => sbesRoute,
  path: '/',
  component: SbesPage,
});

const SbeBreadcrumb = () => {
  const params = useParams({ from: sbeRoute.id });
  const sbe = sbeQueries.useOne({ id: params.sbeId, tenantId: params.asId });
  return sbe.data?.displayName ?? params.sbeId;
};

export const sbeRoute = new Route({
  getParentRoute: () => sbesRoute,
  path: '$sbeId',
  validateSearch: (search): { edit?: boolean } =>
    typeof search.edit === 'boolean' ? { edit: search.edit } : {},
  getContext: ({ params }) => {
    return {
      breadcrumb: () => ({ title: SbeBreadcrumb, params }),
    };
  },
});

export const sbeIndexRoute = new Route({
  getParentRoute: () => sbeRoute,
  path: '/',
  component: SbePage,
});

export const SbeLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetSbeDto>, unknown>;
}) => {
  const params = useParams({ from: asRoute.id });
  const sbe = getEntityFromQuery(props.id, props.query);
  return sbe ? (
    <Link as="span">
      <RouterLink
        title="Go to sbe"
        to={sbeRoute.fullPath}
        params={{
          asId: params.asId,
          sbeId: String(sbe.id),
        }}
      >
        {getRelationDisplayName(sbe.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Sbe may have been deleted." as="i" color="gray.500">
      not found
    </Text>
  ) : null;
};
