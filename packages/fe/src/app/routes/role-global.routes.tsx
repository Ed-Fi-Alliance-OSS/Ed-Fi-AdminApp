import { Link, Text } from '@chakra-ui/react';
import { GetRoleDto } from '@edanalytics/models';
import { UseQueryResult } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router-dom';
import { RoleGlobalPage } from '../Pages/RoleGlobal/RoleGlobalPage';
import { RolesGlobalPage } from '../Pages/RoleGlobal/RolesGlobalPage';
import { roleQueries } from '../api';
import { getRelationDisplayName } from '../helpers';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';
import { CreateRoleGlobalPage } from '../Pages/RoleGlobal/CreateRoleGlobal';

const RoleGlobalBreadcrumb = () => {
  const params = useParams() as { roleId: string };
  const roleglobal = roleQueries.useOne({
    id: params.roleId,
  });
  return roleglobal.data?.displayName ?? params.roleId;
};

export const roleGlobalIndexRoute: RouteObject = {
  path: '/roles/:roleId/',
  element: <RoleGlobalPage />,
};
export const roleGlobalCreateRoute: RouteObject = {
  path: '/roles/create',
  element: <CreateRoleGlobalPage />,
};
export const roleGlobalRoute: RouteObject = {
  path: '/roles/:roleId',
  handle: { crumb: RoleGlobalBreadcrumb },
};
export const rolesGlobalIndexRoute: RouteObject = {
  path: '/roles/',
  element: <RolesGlobalPage />,
};
export const rolesGlobalRoute: RouteObject = {
  path: '/roles',
  handle: { crumb: () => 'Roles' },
};

export const RoleGlobalLink = (props: {
  id: number | undefined;
  query: UseQueryResult<Record<string | number, GetRoleDto>, unknown>;
}) => {
  const role = getEntityFromQuery(props.id, props.query);
  return role ? (
    <Link as="span">
      <RouterLink title="Go to roleglobal" to={`/roles/${role.id}`}>
        {getRelationDisplayName(role.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'number' ? (
    <Text title="RoleGlobal may have been deleted." as="i" color="gray.500">
      not found
    </Text>
  ) : null;
};
