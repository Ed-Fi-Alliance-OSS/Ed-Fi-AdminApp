import { Link, Text } from '@chakra-ui/react';
import { Link as RouterLink, Route, useParams } from '@tanstack/router';
import { UseQueryResult } from '@tanstack/react-query';
import { GetUserTenantMembershipDto } from '@edanalytics/models';
import { mainLayoutRoute } from '.';
import { getRelationDisplayName } from '../helpers';
import { useUserTenantMemberships } from '../api';
import { UserTenantMembershipPage } from '../Pages/UserTenantMembership/UserTenantMembershipPage';
import { UserTenantMembershipsPage } from '../Pages/UserTenantMembership/UserTenantMembershipsPage';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

export const userTenantMembershipsRoute = new Route({
  getParentRoute: () => mainLayoutRoute,
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
  const userTenantMembership = useUserTenantMemberships();
  return (
    userTenantMembership.data?.[params.userTenantMembershipId]?.displayName ??
    params.userTenantMembershipId
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
  const userTenantMembership = getEntityFromQuery(props.id, props.query);
  return userTenantMembership ? (
    <Link as="span">
      <RouterLink
        title="Go to userTenantMembership"
        to={userTenantMembershipRoute.fullPath}
        params={{
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
