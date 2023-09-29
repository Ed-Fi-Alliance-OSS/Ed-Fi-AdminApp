import { PageActions, PageTemplate, SbaaTableAllInOne } from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { vendorQueries } from '../../api';
import { NameCell } from './NameCell';
import { useManyVendorActions } from './useVendorActions';

export const VendorsPageContent = () => {
  const params = useParams() as { asId: string; sbeId: string };
  const vendors = vendorQueries.useAll({
    sbeId: params.sbeId,
    tenantId: params.asId,
  });
  return (
    <SbaaTableAllInOne
      data={Object.values(vendors?.data || {})}
      columns={[
        {
          accessorKey: 'company',
          cell: NameCell,
          header: 'Company',
        },
        {
          accessorKey: 'namespacePrefixes',
          header: 'Namespace',
        },
        {
          accessorKey: 'contactName',
          header: 'Contact',
        },
      ]}
    />
  );
};

export const VendorsPage = () => {
  const actions = useManyVendorActions();
  return (
    <PageTemplate title="Vendors" actions={<PageActions actions={actions} />}>
      <VendorsPageContent />
    </PageTemplate>
  );
};
