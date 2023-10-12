import { SbaaTableAllInOne, PageTemplate, PageActions } from '@edanalytics/common-ui';
import { claimsetQueries } from '../../api';
import { useNavContext } from '../../helpers';
import { NameCell } from './NameCell';
import { useManyClaimsetActions } from './useClaimsetActions';
import { OnChangeFn, RowSelectionState } from '@tanstack/react-table';
import { useState } from 'react';

export const ClaimsetsPage = () => {
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
  const navContext = useNavContext();
  const sbeId = navContext.sbeId!;
  const asId = navContext.asId!;

  const claimsets = claimsetQueries.useAll({
    tenantId: asId,
    sbeId: sbeId,
  });

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
          accessorKey: 'isSystemReserved',
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
