import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetOdsDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import { odsQueries } from '../../api/queries/queries';
import { useNavContext } from '../../helpers';
import { useReadTenantEntity } from '../../helpers/useStandardRowActionsNew';
import { OdsLink, odsRoute } from '../../routes';

export const NameCell = (info: CellContext<GetOdsDto, unknown>) => {
  const navContext = useNavContext();
  const sbeId = navContext.sbeId!;
  const asId = navContext.asId!;
  const entities = odsQueries.useAll({
    sbeId: sbeId,
    tenantId: asId,
  });
  const View = useReadTenantEntity({
    entity: info.row.original,
    params: { asId, sbeId, odsId: info.row.original.id },
    privilege: 'tenant.sbe.ods:read',
    route: odsRoute,
  });
  const actions = {
    ...(View ? { View } : undefined),
  };
  return (
    <HStack justify="space-between">
      <OdsLink id={info.row.original.id} query={entities} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
