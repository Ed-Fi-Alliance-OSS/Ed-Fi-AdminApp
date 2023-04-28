import { Heading, HStack } from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import { useSbes, useDeleteSbe, useUsers } from '../../api';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { StandardRowActions } from '../../helpers/getStandardActions';
import { UserLink, sbeRoute, SbeLink } from '../../routes';

export const SbesPage = () => {
  const sbes = useSbes();
  const deleteSbe = useDeleteSbe();
  const users = useUsers();

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
                    params={{ sbeId: String(info.row.original.id) }}
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
