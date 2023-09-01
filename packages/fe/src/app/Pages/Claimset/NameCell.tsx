import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetClaimsetDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import { claimsetQueries } from '../../api';

import { useNavContext } from '../../helpers';
import { ClaimsetLink } from '../../routes';
import { useClaimsetActions } from './useClaimsetActions';

export const NameCell = (info: CellContext<GetClaimsetDto, unknown>) => {
  const navContext = useNavContext();
  const sbeId = navContext.sbeId!;
  const asId = navContext.asId!;

  const entities = claimsetQueries.useAll({
    tenantId: asId,
    sbeId: sbeId,
  });

  const actions = useClaimsetActions({
    claimset: info.row.original,
  });
  return (
    <HStack justify="space-between">
      <ClaimsetLink id={info.row.original.id} query={entities} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
