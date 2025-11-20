import {
  CappedLinesText,
  PageActions,
  PageTemplate,
  SbaaTableAllInOne,
} from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { vendorQueriesV1 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { NameCell } from './NameCell';
import { useManyVendorActions } from './useVendorActions';

export const VendorsPageContent = () => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const vendors = useQuery(
    vendorQueriesV1.getAll({
      edfiTenant,
      teamId,
    })
  );
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
          cell: ({ getValue }) => (
            <CappedLinesText maxLines={2}>{getValue() as string}</CappedLinesText>
          ),
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
