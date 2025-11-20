import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetClaimsetMultipleDtoV2 } from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { CellContext } from '@tanstack/react-table';
import { claimsetQueriesV2 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { ClaimsetLinkV2 } from '../../routes';
import { useClaimsetActions } from './useClaimsetActions';

export const NameCell = (info: CellContext<GetClaimsetMultipleDtoV2, unknown>) => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const entities = useQuery(
    claimsetQueriesV2.getAll({
      teamId,
      edfiTenant,
    })
  );

  const actions = useClaimsetActions({
    claimset: info.row.original,
  });
  return (
    <HStack justify="space-between">
      <ClaimsetLinkV2 id={info.row.original.id} query={entities} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
