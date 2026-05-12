import {
  CappedLinesText,
  PageActions,
  PageTemplate,
  SbaaTableAllInOne,
} from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { vendorQueriesV2, vendorQueriesV3 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { NameCell } from './NameCell';
import { useManyVendorActions } from './useVendorActions';

type VendorVersion = 'v2' | 'v3';

const getVendorQueriesByVersion = (version: VendorVersion) => {

  /// print version for debugging
  console.log('Vendor version:', version);
  
  if (version === 'v2') return vendorQueriesV2;
  return vendorQueriesV3;
};

type VendorsPageContentProps = {
  version?: VendorVersion;
};

export const VendorsPageContent = ({ version = 'v3' }: VendorsPageContentProps) => {
  const { edfiTenant, asId } = useTeamEdfiTenantNavContextLoaded();
  const vendorQueries = getVendorQueriesByVersion(version);

  const vendors = useQuery(
    vendorQueries.getAll({
      teamId: asId,
      edfiTenant,
    })
  );
  return (
    <SbaaTableAllInOne
      data={Object.values(vendors?.data || {})}
      columns={[
        {
          accessorKey: 'id',
          header: 'ID',
        },
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

type VendorsPageV2Props = {
  version?: VendorVersion;
};

export const VendorsPageV2 = ({ version = 'v3' }: VendorsPageV2Props) => {
  const actions = useManyVendorActions();
  return (
    <PageTemplate title="Vendors" actions={<PageActions actions={actions} />}>
      <VendorsPageContent version={version} />
    </PageTemplate>
  );
};
