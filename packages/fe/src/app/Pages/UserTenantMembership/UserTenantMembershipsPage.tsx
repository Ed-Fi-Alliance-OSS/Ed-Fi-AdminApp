import { Heading, HStack } from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { StandardRowActions } from '../../helpers/getStandardActions';
import {
  UserLink,
  userTenantMembershipRoute,
  userTenantMembershipsRoute,
  UserTenantMembershipLink,
} from '../../routes';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from '@tanstack/router';
import { userTenantMembershipQueries, userQueries } from '../../api';

export const UserTenantMembershipsPage = () => {
  const params = useParams({ from: userTenantMembershipsRoute.id });
  const userTenantMemberships = userTenantMembershipQueries.useAll({
    tenantId: params.asId,
  });
  const deleteUserTenantMembership = userTenantMembershipQueries.useDelete({
    tenantId: params.asId,
  });
  const users = userQueries.useAll({ tenantId: params.asId });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        UserTenantMemberships
      </Heading>
      <DataTable
        data={Object.values(userTenantMemberships?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: (info) => (
              <HStack justify="space-between">
                <UserTenantMembershipLink
                  id={info.row.original.id}
                  query={userTenantMemberships}
                />
                <HStack className="row-hover" color="gray.600" align="middle">
                  <StandardRowActions
                    info={info}
                    mutation={deleteUserTenantMembership.mutate}
                    route={userTenantMembershipRoute}
                    params={(params: any) => ({
                      ...params,
                      userTenantMembershipId: String(info.row.original.id),
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
