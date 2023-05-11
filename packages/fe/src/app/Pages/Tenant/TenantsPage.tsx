import { Heading, HStack } from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { StandardRowActions } from '../../helpers/getStandardActions';
import { UserLink, tenantRoute, tenantsRoute, TenantLink } from '../../routes';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from '@tanstack/router';
import { tenantQueries, userQueries } from '../../api';

export const TenantsPage = () => {
  const params = useParams({ from: tenantsRoute.id });
  const tenants = tenantQueries.useAll({});
  const deleteTenant = tenantQueries.useDelete({});
  // TODO fix this as soon as tenant urls are validated using fake .Required flag
  const users = userQueries.useAll({ tenantId: 1 });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        Tenants
      </Heading>
      <DataTable
        data={Object.values(tenants?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: (info) => (
              <HStack justify="space-between">
                <TenantLink id={info.row.original.id} query={tenants} />
                <HStack className="row-hover" color="gray.600" align="middle">
                  <StandardRowActions
                    info={info}
                    mutation={deleteTenant.mutate}
                    route={tenantRoute}
                    params={(params: any) => ({
                      ...params,
                      tenantId: String(info.row.original.id),
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
