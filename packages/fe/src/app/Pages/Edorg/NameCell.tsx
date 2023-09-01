import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetEdorgDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import { edorgQueries } from '../../api';

import { useNavContext } from '../../helpers';
import { useReadTenantEntity } from '../../helpers/useStandardRowActionsNew';
import { EdorgLink, edorgIndexRoute } from '../../routes';

export const NameCell = (info: CellContext<GetEdorgDto, unknown>) => {
  const { asId, sbeId } = useNavContext() as { sbeId: number; asId: number };

  const entities = edorgQueries.useAll({
    tenantId: asId,
    sbeId: sbeId,
  });

  const View = useReadTenantEntity({
    entity: info.row.original,
    params: { sbeId, asId, edorgId: info.row.original.id },
    privilege: 'tenant.sbe.edorg:read',
    route: edorgIndexRoute,
  });
  const actions = {
    ...(View ? { View } : undefined),
  };
  return (
    <HStack justify="space-between">
      <EdorgLink id={info.row.original.id} query={entities} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
