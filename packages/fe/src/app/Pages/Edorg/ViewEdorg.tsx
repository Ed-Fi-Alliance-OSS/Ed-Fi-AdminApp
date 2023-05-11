import { FormLabel, Text } from '@chakra-ui/react';
import { useParams } from '@tanstack/router';
import { edorgQueries } from '../../api';
import { edorgRoute } from '../../routes';

export const ViewEdorg = () => {
  const params = useParams({ from: edorgRoute.id });
  const edorg = edorgQueries.useOne({
    id: params.edorgId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;

  return edorg ? (
    <>
      {/* TODO: replace this with real content */}
      <FormLabel as="p">Id</FormLabel>
      <Text>{edorg.id}</Text>
    </>
  ) : null;
};
