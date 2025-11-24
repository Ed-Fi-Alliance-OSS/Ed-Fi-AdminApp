import { PageActions, PageTemplate, SbaaTableAllInOne } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { OnChangeFn, RowSelectionState } from '@tanstack/react-table';
import { useState } from 'react';
import { claimsetQueriesV2 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { NameCell } from './NameCell';
import { useManyClaimsetActions } from './useClaimsetActions';

export const ClaimsetsPageV2 = () => {
  const [selectedRows, setSelectedRows] = useState<RowSelectionState>({});
  const actions = useManyClaimsetActions({ selectionState: selectedRows });
  return (
    <PageTemplate title="Claimsets" actions={<PageActions actions={actions} />}>
      <ClaimsetsPageContent selectedRows={selectedRows} setSelectedRows={setSelectedRows} />
    </PageTemplate>
  );
};

export const ClaimsetsPageContent = ({
  selectedRows,
  setSelectedRows,
}: {
  selectedRows: RowSelectionState;
  setSelectedRows: OnChangeFn<RowSelectionState>;
}) => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  const claimsets = useQuery(
    claimsetQueriesV2.getAll({
      teamId,
      edfiTenant,
    })
  );

  return (
    <SbaaTableAllInOne
      enableRowSelection
      rowSelectionState={selectedRows}
      onRowSelectionChange={setSelectedRows}
      data={Object.values(claimsets?.data || {})}
      columns={[
        {
          accessorKey: 'displayName',
          cell: NameCell,
          header: 'Name',
        },
        {
          accessorKey: '_isSystemReserved',
          header: 'Is system-reserved',
          meta: {
            type: 'options',
          },
        },
        {
          accessorKey: 'applicationsCount',
          header: 'Applications count',
          meta: {
            type: 'number',
          },
        },
      ]}
    />
  );
};
