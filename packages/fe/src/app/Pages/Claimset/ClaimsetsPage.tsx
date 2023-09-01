import { SbaaTableAllInOne, PageTemplate } from '@edanalytics/common-ui';
import { claimsetQueries } from '../../api';
import { useNavContext } from '../../helpers';
import { NameCell } from './NameCell';

export const ClaimsetsPage = () => {
  return (
    <PageTemplate title="Claimsets">
      <ClaimsetsPageContent />
    </PageTemplate>
  );
};

export const ClaimsetsPageContent = () => {
  const navContext = useNavContext();
  const sbeId = navContext.sbeId!;
  const asId = navContext.asId!;

  const claimsets = claimsetQueries.useAll({
    tenantId: asId,
    sbeId: sbeId,
  });

  return (
    <SbaaTableAllInOne
      data={Object.values(claimsets?.data || {})}
      columns={[
        {
          accessorKey: 'displayName',
          cell: NameCell,
          header: 'Name',
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
