import { HStack } from '@chakra-ui/react';
import { SbaaTableAllInOne, PageTemplate } from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { vendorQueries } from '../../api';
import { VendorLink } from '../../routes';

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
          cell: (info) => (
            <HStack justify="space-between">
              <VendorLink id={info.row.original.vendorId} query={vendors} />
              <HStack className="row-hover" color="gray.600" align="middle"></HStack>
            </HStack>
          ),
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
export const VendorsPage = () => (
  <PageTemplate title="Vendors">
    <VendorsPageContent />
  </PageTemplate>
);
