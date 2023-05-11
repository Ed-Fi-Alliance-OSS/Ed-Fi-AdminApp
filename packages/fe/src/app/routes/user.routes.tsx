import { Link, Text } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, Route, useParams } from '@tanstack/router';
import { UseQueryResult } from '@tanstack/react-query';
import { GetUserDto } from '@edanalytics/models';
import { asRoute } from '.';
import { getRelationDisplayName } from '../helpers';
import { userQueries } from '../api';
import { UserPage } from '../Pages/User/UserPage';
import { UsersPage } from '../Pages/User/UsersPage';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

export const usersRoute = new Route({
  getParentRoute: () => asRoute,
  path: 'users',
  getContext: ({ params }) => ({
    breadcrumb: () => ({ title: () => 'Users', params }),
  }),
});

export const usersIndexRoute = new Route({
  getParentRoute: () => usersRoute,
  path: '/',
  component: UsersPage,
});

const UserBreadcrumb = () => {
  const params = useParams({ from: userRoute.id });
  const user = userQueries.useOne({ id: params.userId, tenantId: params.asId });
  return user.data?.displayName ?? params.userId;
};

export const userRoute = new Route({
  getParentRoute: () => usersRoute,
  path: '$userId',
  validateSearch: (search): { edit?: boolean } =>
    typeof search.edit === 'boolean' ? { edit: search.edit } : {},
  getContext: ({ params }) => {
    return {
      breadcrumb: () => ({ title: UserBreadcrumb, params }),
    };
  },
});

export const userIndexRoute = new Route({
  getParentRoute: () => userRoute,
  path: '/',
  component: UserPage,
});

export const UserLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetUserDto>, unknown>;
}) => {
  const params = useParams({ from: asRoute.id });
  const user = getEntityFromQuery(props.id, props.query);
  return user ? (
    <Link as="span">
      <RouterLink
        title="Go to user"
        to={userRoute.fullPath}
        params={{
          asId: params.asId,
          userId: String(user.id),
        }}
      >
        {getRelationDisplayName(user.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="User may have been deleted." as="i" color="gray.500">
      not found
    </Text>
  ) : null;
};
