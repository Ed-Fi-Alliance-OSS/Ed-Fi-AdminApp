import { Heading, HStack } from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import { useUsers, useDeleteUser, useTenantUsers } from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { StandardRowActions } from '../../helpers/getStandardActions';
import { UserLink, userRoute, usersRoute } from '../../routes';
import { useParams } from '@tanstack/router';

export const UsersPage = () => {
  const params = useParams({ from: usersRoute.id });
  const users = useTenantUsers(params.asId);
  const deleteUser = useDeleteUser();

  return (
    <>
      <Heading mb={4} fontSize="lg">
        Users
      </Heading>
      <DataTable
        data={Object.values(users?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: (info) => (
              <HStack justify="space-between">
                <UserLink id={info.row.original.id} query={users} />
                <HStack className="row-hover" color="gray.600" align="middle">
                  <StandardRowActions
                    info={info}
                    mutation={deleteUser.mutate}
                    route={userRoute}
                    params={{ userId: String(info.row.original.id) }}
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
