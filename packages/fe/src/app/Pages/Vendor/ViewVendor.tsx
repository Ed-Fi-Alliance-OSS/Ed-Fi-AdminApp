import { Text } from '@chakra-ui/react';
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
      {/* TODO: replace this with real content */}
      <Text as="strong">Company</Text>
      <Text>{vendor.company}</Text>
    </>
  ) : null;
};
