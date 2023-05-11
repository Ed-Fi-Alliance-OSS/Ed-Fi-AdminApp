import { Heading, HStack } from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { StandardRowActions } from '../../helpers/getStandardActions';
import { UserLink, sbeRoute, sbesRoute, SbeLink } from '../../routes';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from '@tanstack/router';
import { sbeQueries, userQueries } from '../../api';

export const SbesPage = () => {
  const params = useParams({ from: sbesRoute.id });
  const sbes = sbeQueries.useAll({
    tenantId: params.asId,
  });
  const deleteSbe = sbeQueries.useDelete({
    tenantId: params.asId,
  });
  const users = userQueries.useAll({ tenantId: params.asId });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        Sbes
      </Heading>
      <DataTable
        data={Object.values(sbes?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: (info) => (
              <HStack justify="space-between">
                <SbeLink id={info.row.original.id} query={sbes} />
                <HStack className="row-hover" color="gray.600" align="middle">
                  <StandardRowActions
                    info={info}
                    mutation={deleteSbe.mutate}
                    route={sbeRoute}
                    params={(params: any) => ({
                      ...params,
                      sbeId: String(info.row.original.id),
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
