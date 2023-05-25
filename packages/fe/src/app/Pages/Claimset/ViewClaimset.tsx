import { FormLabel, Text } from '@chakra-ui/react';
import { useParams, useSearch } from '@tanstack/router';
import { claimsetQueries } from '../../api';
import { claimsetIndexRoute, claimsetRoute } from '../../routes';

export const ViewClaimset = () => {
  const params = useParams({ from: claimsetRoute.id });
  const claimset = claimsetQueries.useOne({
    id: params.claimsetId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;
  const { edit } = useSearch({ from: claimsetIndexRoute.id });

  return claimset ? (
    <>
      <FormLabel as="p">Is reserved</FormLabel>
      <Text>{String(claimset.isSystemReserved ?? false)}</Text>
      <FormLabel as="p">Applications</FormLabel>
      <Text>{claimset.applicationsCount}</Text>
    </>
  ) : null;
};
