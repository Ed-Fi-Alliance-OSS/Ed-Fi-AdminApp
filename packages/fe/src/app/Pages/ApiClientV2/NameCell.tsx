import { HStack } from '@chakra-ui/react';
import { TableRowActions } from '@edanalytics/common-ui';
import { GetApiClientDtoV2 } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';

import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useSingleApiClientActions } from './useApiClientActions';
import { ApiClientLinkV2 } from '../../routes/apiclients.routes';

export const NameCell = (
  info: CellContext<GetApiClientDtoV2, unknown>
) => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  var entities = [
      {
        id: 1,
        name: "My app credentials 1",
        key: "mykey1",
        isApproved: true,
        useSandbox: false,
        keyStatus: "Active",
        applicationId: 1,
        odsInstanceIds: [0]
      } as GetApiClientDtoV2,
      {
        id: 2,
        name: "My app credentials 2",
        key: "mykey2",
        isApproved: true,
        useSandbox: false,
        keyStatus: "Active",
        applicationId: 1,
        odsInstanceIds: [0]
      } as GetApiClientDtoV2,
    ] as any as [GetApiClientDtoV2];

  const actions = useSingleApiClientActions({
    apiClient: info.row.original,
  });
  return (
    <HStack justify="space-between">
      <ApiClientLinkV2 id={info.row.original.id} applicationId={info.row.original.applicationId} />
      <TableRowActions actions={actions} />
    </HStack>
  );
};
