import { Heading, HStack } from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import { useParams } from '@tanstack/router';
import { vendorQueries } from '../../api';
import { VendorLink, vendorsRoute } from '../../routes';

export const VendorsPage = () => {
  const params = useParams({ from: vendorsRoute.id });
  const vendors = vendorQueries.useAll({
    sbeId: params.sbeId,
    tenantId: params.asId,
  });
  const deleteVendor = vendorQueries.useDelete({
    sbeId: params.sbeId,
    tenantId: params.asId,
  });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        Vendors
      </Heading>
      <DataTable
        data={Object.values(vendors?.data || {})}
        columns={[
          {
            accessorKey: 'company',
            cell: (info) => (
              <HStack justify="space-between">
                <VendorLink
                  id={info.row.original.vendorId}
                  query={vendors}
                  sbeId={params.sbeId}
                />
                <HStack
                  className="row-hover"
                  color="gray.600"
                  align="middle"
                ></HStack>
              </HStack>
            ),
            header: () => 'Company',
          },
          {
            accessorKey: 'namespacePrefixes',
            header: () => 'Namespace',
          },
          {
            accessorKey: 'contactName',
            header: () => 'Contact',
          },
        ]}
      />
    </>
  );
};
