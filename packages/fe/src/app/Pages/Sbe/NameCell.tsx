import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetSbeDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import { sbeQueries } from '../../api';
import { useNavContext } from '../../helpers';
import { useReadTenantEntity } from '../../helpers/useStandardRowActionsNew';
import { SbeLink, sbeRoute } from '../../routes';

export const NameCell = (info: CellContext<GetSbeDto, unknown>) => {
  const navContext = useNavContext();
  const asId = navContext.asId!;

  const sbes = sbeQueries.useAll({
    tenantId: asId,
  });
  const View = useReadTenantEntity({
    entity: info.row.original,
    params: { sbeId: String(info.row.original.id), asId },
    privilege: 'tenant.user:read',
    route: sbeRoute,
  });
  const actions = {
    ...(View ? { View } : undefined),
  };
  return (
    <HStack justify="space-between">
      <SbeLink id={info.row.original.id} query={sbes} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
