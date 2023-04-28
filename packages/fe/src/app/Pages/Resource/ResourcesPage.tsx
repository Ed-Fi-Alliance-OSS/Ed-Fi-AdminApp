import { Heading, HStack } from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import { useResources, useDeleteResource, useUsers } from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { StandardRowActions } from '../../helpers/getStandardActions';
import {
  UserLink,
  resourceRoute,
  resourcesRoute,
  ResourceLink,
} from '../../routes';
import { useParams } from '@tanstack/router';

export const ResourcesPage = () => {
  const params = useParams({ from: resourcesRoute.id });
  const resources = useResources();
  const deleteResource = useDeleteResource();
  const users = useUsers();

  return (
    <>
      <Heading mb={4} fontSize="lg">
        Resources
      </Heading>
      <DataTable
        data={Object.values(resources?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: (info) => (
              <HStack justify="space-between">
                <ResourceLink id={info.row.original.id} query={resources} />
                <HStack className="row-hover" color="gray.600" align="middle">
                  <StandardRowActions
                    info={info}
                    mutation={deleteResource.mutate}
                    route={resourceRoute}
                    params={(params: any) => ({
                      ...params,
                      resourceId: String(info.row.original.id),
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
