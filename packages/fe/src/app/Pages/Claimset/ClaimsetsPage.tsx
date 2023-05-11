import { Heading, HStack } from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { StandardRowActions } from '../../helpers/getStandardActions';
import {
  UserLink,
  claimsetRoute,
  claimsetsRoute,
  ClaimsetLink,
} from '../../routes';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from '@tanstack/router';
import { claimsetQueries, userQueries } from '../../api';

export const ClaimsetsPage = () => {
  const params = useParams({ from: claimsetsRoute.id });
  const claimsets = claimsetQueries.useAll({
    tenantId: params.asId,
    sbeId: params.sbeId,
  });
  const deleteClaimset = claimsetQueries.useDelete({
    tenantId: params.asId,
    sbeId: params.sbeId,
  });
  const users = userQueries.useAll({ tenantId: params.asId });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        Claimsets
      </Heading>
      <DataTable
        data={Object.values(claimsets?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: (info) => (
              <HStack justify="space-between">
                <ClaimsetLink
                  id={info.row.original.id}
                  query={claimsets}
                  sbeId={params.sbeId}
                />
                <HStack
                  className="row-hover"
                  color="gray.600"
                  align="middle"
                ></HStack>
              </HStack>
            ),
            header: () => 'Name',
          },
          {
            accessorKey: 'applicationsCount',
            header: () => 'Applications count',
          },
        ]}
      />
    </>
  );
};
