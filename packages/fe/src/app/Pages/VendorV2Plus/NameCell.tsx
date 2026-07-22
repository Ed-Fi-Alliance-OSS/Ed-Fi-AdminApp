import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetVendorDtoV2 } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';

import { useQuery } from '@tanstack/react-query';
import { vendorQueriesV2 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { VendorLinkV2 } from '../../routes';
import { useVendorActions } from './useVendorActions';

export const NameCell = (info: CellContext<GetVendorDtoV2, unknown>) => {
  const { edfiTenant, teamId, edfiTenantId, asId } = useTeamEdfiTenantNavContextLoaded();
  const vendors = useQuery(
    vendorQueriesV2.getAll({
      teamId,
      edfiTenant,
    })
  );
  const actions = useVendorActions(info.row.original);
  return (
    <HStack justify="space-between">
      <VendorLinkV2 id={info.row.original.id} query={vendors} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
