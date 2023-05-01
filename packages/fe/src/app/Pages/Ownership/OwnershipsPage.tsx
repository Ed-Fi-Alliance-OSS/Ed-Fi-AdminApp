import { Heading, HStack } from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import {
  useOwnerships,
  useDeleteOwnership,
  useUsers,
  useTenantOwnerships,
  useTenantUsers,
} from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { StandardRowActions } from '../../helpers/getStandardActions';
import {
  UserLink,
  ownershipRoute,
  ownershipsRoute,
  OwnershipLink,
} from '../../routes';
import { useParams } from '@tanstack/router';

export const OwnershipsPage = () => {
  const params = useParams({ from: ownershipsRoute.id });
  const ownerships = useTenantOwnerships(params.asId);
  const deleteOwnership = useDeleteOwnership();
  const users = useTenantUsers(params.asId);

  return (
    <>
      <Heading mb={4} fontSize="lg">
        Ownerships
      </Heading>
      <DataTable
        data={Object.values(ownerships?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: (info) => (
              <HStack justify="space-between">
                <OwnershipLink id={info.row.original.id} query={ownerships} />
                <HStack className="row-hover" color="gray.600" align="middle">
                  <StandardRowActions
                    info={info}
                    mutation={deleteOwnership.mutate}
                    route={ownershipRoute}
                    params={(params: any) => ({
                      ...params,
                      ownershipId: String(info.row.original.id),
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
