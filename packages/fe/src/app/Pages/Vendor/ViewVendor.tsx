import { FormLabel, Text } from '@chakra-ui/react';
import { useParams } from '@tanstack/router';
import { vendorQueries } from '../../api';
import { vendorRoute } from '../../routes';

export const ViewVendor = () => {
  const params = useParams({ from: vendorRoute.id });
  const vendor = vendorQueries.useOne({
    id: params.vendorId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;

  return vendor ? (
    <>
      <FormLabel as="p">Company</FormLabel>
      <Text>{vendor.company}</Text>
      <FormLabel as="p">Namespace</FormLabel>
      <Text>
        {vendor.namespacePrefixes === '' ? '-' : vendor.namespacePrefixes}
      </Text>
      <FormLabel as="p">Contact</FormLabel>
      <Text>{vendor.contactName}</Text>
      {vendor.contactEmailAddress ? (
        <Text href={`mailto:${vendor.contactEmailAddress}`} as="a">
          {vendor.contactEmailAddress}
        </Text>
      ) : null}
    </>
  ) : null;
};
