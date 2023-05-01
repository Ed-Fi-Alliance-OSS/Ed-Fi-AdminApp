import { Heading, HStack } from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import {
  useEdorgs,
  useDeleteEdorg,
  useUsers,
  useOdss,
  useTenantOdss,
  useTenantEdorgs,
  useTenantUsers,
} from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { StandardRowActions } from '../../helpers/getStandardActions';
import {
  UserLink,
  edorgRoute,
  edorgsRoute,
  EdorgLink,
  OdsLink,
} from '../../routes';
import { useParams } from '@tanstack/router';

export const EdorgsPage = () => {
  const params = useParams({ from: edorgsRoute.id });
  const edorgs = useTenantEdorgs(params.sbeId, params.asId);
  const odss = useTenantOdss(params.sbeId, params.asId);
  const deleteEdorg = useDeleteEdorg();
  const users = useTenantUsers(params.asId);

  return (
    <>
      <Heading mb={4} fontSize="lg">
        Edorgs
      </Heading>
      <DataTable
        data={Object.values(edorgs?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: (info) => (
              <HStack justify="space-between">
                <EdorgLink id={info.row.original.id} query={edorgs} />
                <HStack className="row-hover" color="gray.600" align="middle">
                  <StandardRowActions
                    info={info}
                    mutation={deleteEdorg.mutate}
                    route={edorgRoute}
                    params={(params: any) => ({
                      ...params,
                      edorgId: String(info.row.original.id),
                    })}
                  />
                </HStack>
              </HStack>
            ),
            header: () => 'Name',
          },
          {
            id: 'parent',
            accessorFn: (info) => getRelationDisplayName(info.parentId, edorgs),
            header: () => 'Parent Ed-Org',
            cell: (info) => (
              <EdorgLink query={edorgs} id={info.row.original.parentId} />
            ),
          },
          {
            id: 'ods',
            accessorFn: (info) => getRelationDisplayName(info.odsId, odss),
            header: () => 'ODS',
            cell: (info) => (
              <OdsLink query={odss} id={info.row.original.odsId} />
            ),
          },
          {
            id: 'discriminator',
            accessorFn: (info) => info.discriminator,
            header: () => 'Type',
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
