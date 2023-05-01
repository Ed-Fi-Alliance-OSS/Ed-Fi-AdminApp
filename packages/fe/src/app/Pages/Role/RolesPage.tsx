import { Heading, HStack } from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import {
  useRoles,
  useDeleteRole,
  useUsers,
  useTenantRoles,
  useTenantUsers,
} from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { StandardRowActions } from '../../helpers/getStandardActions';
import { UserLink, roleRoute, rolesRoute, RoleLink } from '../../routes';
import { useParams } from '@tanstack/router';

export const RolesPage = () => {
  const params = useParams({ from: rolesRoute.id });
  const roles = useTenantRoles(params.asId);
  const deleteRole = useDeleteRole();
  const users = useTenantUsers(params.asId);

  return (
    <>
      <Heading mb={4} fontSize="lg">
        Roles
      </Heading>
      <DataTable
        data={Object.values(roles?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: (info) => (
              <HStack justify="space-between">
                <RoleLink id={info.row.original.id} query={roles} />
                <HStack className="row-hover" color="gray.600" align="middle">
                  <StandardRowActions
                    info={info}
                    mutation={deleteRole.mutate}
                    route={roleRoute}
                    params={(params: any) => ({
                      ...params,
                      roleId: String(info.row.original.id),
                    })}
                  />
                </HStack>
              </HStack>
            ),
            header: () => 'Name',
          },
          {
            id: 'modifiedBy',
            accessorFn: (info) =>
              getRelationDisplayName(info.modifiedById, users),
            header: () => 'Modified by',
            cell: (info) => (
              <UserLink query={users} id={info.row.original.modifiedById} />
            ),
          },
          {
            accessorKey: 'createdDetailed',
            header: () => 'Created',
          },
          {
            id: 'createdBy',
            accessorFn: (info) =>
              getRelationDisplayName(info.createdById, users),
            header: () => 'Created by',
            cell: (info) => (
              <UserLink query={users} id={info.row.original.createdById} />
            ),
          },
        ]}
      />
    </>
  );
};
