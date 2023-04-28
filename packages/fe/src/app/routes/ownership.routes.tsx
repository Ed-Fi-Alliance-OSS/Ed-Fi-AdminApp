import { Link, Text } from '@chakra-ui/react';
import { Link as RouterLink, Route, useParams } from '@tanstack/router';
import { UseQueryResult } from '@tanstack/react-query';
import { GetOwnershipDto } from '@edanalytics/models';
import { mainLayoutRoute } from '.';
import { getRelationDisplayName } from '../helpers';
import { useOwnerships } from '../api';
import { OwnershipPage } from '../Pages/Ownership/OwnershipPage';
import { OwnershipsPage } from '../Pages/Ownership/OwnershipsPage';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

export const ownershipsRoute = new Route({
  getParentRoute: () => mainLayoutRoute,
  path: 'ownerships',
  getContext: ({ params }) => ({
    breadcrumb: () => ({ title: () => 'Ownerships', params }),
  }),
});

export const ownershipsIndexRoute = new Route({
  getParentRoute: () => ownershipsRoute,
  path: '/',
  component: OwnershipsPage,
});

const OwnershipBreadcrumb = () => {
  const params = useParams({ from: ownershipRoute.id });
  const ownership = useOwnerships();
  return (
    ownership.data?.[params.ownershipId]?.displayName ?? params.ownershipId
  );
};

export const ownershipRoute = new Route({
  getParentRoute: () => ownershipsRoute,
  path: '$ownershipId',
  validateSearch: (search): { edit?: boolean } =>
    typeof search.edit === 'boolean' ? { edit: search.edit } : {},
  getContext: ({ params }) => {
    return {
      breadcrumb: () => ({ title: OwnershipBreadcrumb, params }),
    };
  },
});

export const ownershipIndexRoute = new Route({
  getParentRoute: () => ownershipRoute,
  path: '/',
  component: OwnershipPage,
});

export const OwnershipLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetOwnershipDto>, unknown>;
}) => {
  const ownership = getEntityFromQuery(props.id, props.query);
  return ownership ? (
    <Link as="span">
      <RouterLink
        title="Go to ownership"
        to={ownershipRoute.fullPath}
        params={{
          ownershipId: String(ownership.id),
        }}
      >
        {getRelationDisplayName(ownership.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Ownership may have been deleted." as="i" color="gray.500">
      not found
    </Text>
  ) : null;
};
