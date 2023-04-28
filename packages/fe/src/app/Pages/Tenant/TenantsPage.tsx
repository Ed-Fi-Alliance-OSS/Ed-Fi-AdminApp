import { Heading, HStack } from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import { useTenants, useDeleteTenant, useUsers } from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { StandardRowActions } from '../../helpers/getStandardActions';
import { UserLink, tenantRoute, tenantsRoute, TenantLink } from '../../routes';
import { useParams } from '@tanstack/router';

export const TenantsPage = () => {
  const params = useParams({ from: tenantsRoute.id });
  const tenants = useTenants();
  const deleteTenant = useDeleteTenant();
  const users = useUsers();

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
