import { Link, Text } from '@chakra-ui/react';
import { Link as RouterLink, Route, useParams } from '@tanstack/router';
import { UseQueryResult } from '@tanstack/react-query';
import { GetRoleDto } from '@edanalytics/models';
import { mainLayoutRoute } from '.';
import { getRelationDisplayName } from '../helpers';
import { useRoles } from '../api';
import { RolePage } from '../Pages/Role/RolePage';
import { RolesPage } from '../Pages/Role/RolesPage';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

export const rolesRoute = new Route({
  getParentRoute: () => mainLayoutRoute,
  path: 'roles',
  getContext: ({ params }) => ({
    breadcrumb: () => ({ title: () => 'Roles', params }),
  }),
});

export const rolesIndexRoute = new Route({
  getParentRoute: () => rolesRoute,
  path: '/',
  component: RolesPage,
});

const RoleBreadcrumb = () => {
  const params = useParams({ from: roleRoute.id });
  const role = useRoles();
  return role.data?.[params.roleId]?.displayName ?? params.roleId;
};

export const roleRoute = new Route({
  getParentRoute: () => rolesRoute,
  path: '$roleId',
  validateSearch: (search): { edit?: boolean } =>
    typeof search.edit === 'boolean' ? { edit: search.edit } : {},
  getContext: ({ params }) => {
    return {
      breadcrumb: () => ({ title: RoleBreadcrumb, params }),
    };
  },
});

export const roleIndexRoute = new Route({
  getParentRoute: () => roleRoute,
  path: '/',
  component: RolePage,
});

export const RoleLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetRoleDto>, unknown>;
}) => {
  const role = getEntityFromQuery(props.id, props.query);
  return role ? (
    <Link as="span">
      <RouterLink
        title="Go to role"
        to={roleRoute.fullPath}
        params={{
          roleId: String(role.id),
        }}
      >
        {getRelationDisplayName(role.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="Role may have been deleted." as="i" color="gray.500">
      not found
    </Text>
  ) : null;
};
