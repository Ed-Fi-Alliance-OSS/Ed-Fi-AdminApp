import { Link, Text } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, Route, useParams } from '@tanstack/router';
import { UseQueryResult } from '@tanstack/react-query';
import { GetClaimsetDto } from '@edanalytics/models';
import { mainLayoutRoute, sbeRoute } from '.';
import { getRelationDisplayName } from '../helpers';
import { claimsetQueries } from '../api';
import { ClaimsetPage } from '../Pages/Claimset/ClaimsetPage';
import { ClaimsetsPage } from '../Pages/Claimset/ClaimsetsPage';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

export const claimsetsRoute = new Route({
  getParentRoute: () => sbeRoute,
  path: 'claimsets',
  getContext: ({ params }) => ({
    breadcrumb: () => ({ title: () => 'Claimsets', params }),
  }),
});

export const claimsetsIndexRoute = new Route({
  getParentRoute: () => claimsetsRoute,
  path: '/',
  component: ClaimsetsPage,
});

const ClaimsetBreadcrumb = () => {
  const params = useParams({ from: claimsetRoute.id });
  const claimset = claimsetQueries.useOne({
    id: params.claimsetId,
    tenantId: params.asId,
    sbeId: params.sbeId,
  });
  return claimset.data?.displayName ?? params.claimsetId;
};

export const claimsetRoute = new Route({
  getParentRoute: () => claimsetsRoute,
  path: '$claimsetId',
  validateSearch: (search): { edit?: boolean } =>
    typeof search.edit === 'boolean' ? { edit: search.edit } : {},
  getContext: ({ params }) => {
    return {
      breadcrumb: () => ({ title: ClaimsetBreadcrumb, params }),
    };
  },
});

export const claimsetIndexRoute = new Route({
  getParentRoute: () => claimsetRoute,
  path: '/',
  component: ClaimsetPage,
});

export const ClaimsetLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetClaimsetDto>, unknown>;
  sbeId: string;
}) => {
  const claimset = getEntityFromQuery(props.id, props.query);
  return claimset ? (
    <Link as="span">
      <RouterLink
        title="Go to claimset"
        to={claimsetRoute.fullPath}
        params={(previous: any) => ({
          ...previous,
          claimsetId: String(claimset.id),
          sbeId: props.sbeId,
        })}
      >
        {getRelationDisplayName(claimset.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Claimset may have been deleted." as="i" color="gray.500">
      not found
    </Text>
  ) : null;
};
