import {
  PageActions,
  PageTemplate,
  SbaaTableAllInOne,
} from '@edanalytics/common-ui';

import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { NameCell } from './NameCell';
import { useMultiApiClientsActions } from './useApiClientActions';
import { GetApiClientDtoV2 } from 'packages/models/src/dtos/edfi-admin-api.v2.dto';

export const ApiClientsPageV2 = () => {
  return (
    <PageTemplate title="Application myApp1 credentials" actions={<ApiClientsPageActions />}>
      <AllApiClientsTable />
    </PageTemplate>
  );
};

export const ApiClientsPageActions = () => {
  const { edfiTenantId, asId } = useTeamEdfiTenantNavContextLoaded();

  const actions = useMultiApiClientsActions({
    edfiTenantId: edfiTenantId,
    teamId: asId,
  });
  return <PageActions actions={actions} />;
};

export const AllApiClientsTable = () => {
  var apiClients = [
      {
        id: 1,
        name: "My app credentials 1",
        key: "mykey1",
        isApproved: true,
        useSandbox: false,
        keyStatus: "Active",
        odsInstanceIds: [0]
      },
      {
        id: 2,
        name: "My app credentials 2",
        key: "mykey2",
        isApproved: true,
        useSandbox: false,
        keyStatus: "Active",
        odsInstanceIds: [0]
      },
    ] as any as [GetApiClientDtoV2];

  return (
    <SbaaTableAllInOne
      data={Object.values(apiClients)}
      columns={[
        {
          accessorKey: 'name',
          cell: NameCell,
          header: 'Name',
        },
        {
          accessorKey: 'key',
          header: 'Client id',
        },
        {
          accessorKey: 'isApproved',
          header: 'Enabled',
        },
        {
          accessorKey: 'keyStatus',
          header: 'Status',
        },
        {
          accessorKey: 'useSandbox',
          header: 'Use Sandbox',
        }
      ]}
    />
  );
};
