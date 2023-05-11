import { Heading, HStack } from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import { useParams } from '@tanstack/router';
import { odsQueries, userQueries } from '../../api/queries/queries';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { StandardRowActions } from '../../helpers/getStandardActions';
import { OdsLink, odsRoute, odssRoute, UserLink } from '../../routes';

export const OdssPage = () => {
  const params = useParams({ from: odssRoute.id });
  const odss = odsQueries.useAll({
    sbeId: params.sbeId,
    tenantId: params.asId,
  });
  const deleteOds = odsQueries.useDelete({
    sbeId: params.sbeId,
    tenantId: params.asId,
  });
  const users = userQueries.useAll({ tenantId: params.asId });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        Odss
      </Heading>
      <DataTable
        data={Object.values(odss?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: (info) => (
              <HStack justify="space-between">
                <OdsLink id={info.row.original.id} query={odss} />
                <HStack className="row-hover" color="gray.600" align="middle">
                  <StandardRowActions
                    info={info}
                    mutation={deleteOds.mutate}
                    route={odsRoute}
                    params={(params: any) => ({
                      ...params,
                      odsId: String(info.row.original.id),
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
