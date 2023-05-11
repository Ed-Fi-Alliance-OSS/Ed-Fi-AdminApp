import { Link, Text } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, Route, useParams } from '@tanstack/router';
import { UseQueryResult } from '@tanstack/react-query';
import { GetUserTenantMembershipDto } from '@edanalytics/models';
import { asRoute, mainLayoutRoute } from '.';
import { getRelationDisplayName } from '../helpers';
import { userTenantMembershipQueries } from '../api';
import { UserTenantMembershipPage } from '../Pages/UserTenantMembership/UserTenantMembershipPage';
import { UserTenantMembershipsPage } from '../Pages/UserTenantMembership/UserTenantMembershipsPage';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

export const userTenantMembershipsRoute = new Route({
  getParentRoute: () => asRoute,
  path: 'user-tenant-memberships',
  getContext: ({ params }) => ({
    breadcrumb: () => ({ title: () => 'UserTenantMemberships', params }),
  }),
});

export const userTenantMembershipsIndexRoute = new Route({
  getParentRoute: () => userTenantMembershipsRoute,
  path: '/',
  component: UserTenantMembershipsPage,
});

const UserTenantMembershipBreadcrumb = () => {
  const params = useParams({ from: userTenantMembershipRoute.id });
  const userTenantMembership = userTenantMembershipQueries.useOne({
    id: params.userTenantMembershipId,
    tenantId: params.asId,
  });
  return (
    userTenantMembership.data?.displayName ?? params.userTenantMembershipId
  );
};

export const userTenantMembershipRoute = new Route({
  getParentRoute: () => userTenantMembershipsRoute,
  path: '$userTenantMembershipId',
  validateSearch: (search): { edit?: boolean } =>
    typeof search.edit === 'boolean' ? { edit: search.edit } : {},
  getContext: ({ params }) => {
    return {
      breadcrumb: () => ({ title: UserTenantMembershipBreadcrumb, params }),
    };
  },
});

export const userTenantMembershipIndexRoute = new Route({
  getParentRoute: () => userTenantMembershipRoute,
  path: '/',
  component: UserTenantMembershipPage,
});

export const UserTenantMembershipLink = (props: {
  id: number | undefined;
  query: UseQueryResult<
    Record<string | number, GetUserTenantMembershipDto>,
    unknown
  >;
}) => {
  const params = useParams({ from: asRoute.id });
  const userTenantMembership = getEntityFromQuery(props.id, props.query);
  return userTenantMembership ? (
    <Link as="span">
      <RouterLink
        title="Go to userTenantMembership"
        to={userTenantMembershipRoute.fullPath}
        params={{
          asId: params.asId,
          userTenantMembershipId: String(userTenantMembership.id),
        }}
      >
        {getRelationDisplayName(userTenantMembership.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text
      title="UserTenantMembership may have been deleted."
      as="i"
      color="gray.500"
    >
      not found
    </Text>
  ) : null;
};
