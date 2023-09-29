import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetVendorDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';

import { vendorQueries } from '../../api';
import { VendorLink } from '../../routes';
import { useVendorActions } from './useVendorActions';
import { useNavContext } from '../../helpers';

export const NameCell = (info: CellContext<GetVendorDto, unknown>) => {
  const params = useNavContext();
  const entities = vendorQueries.useAll({
    tenantId: params.asId!,
    sbeId: params.sbeId!,
  });
  const actions = useVendorActions(info.row.original);
  return (
    <HStack justify="space-between">
      <VendorLink id={info.row.original.id} query={entities} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
