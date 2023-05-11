import { Text } from '@chakra-ui/react';
import { useParams } from '@tanstack/router';
import { odsQueries } from '../../api';
import { odsRoute } from '../../routes';

export const ViewOds = () => {
  const params = useParams({ from: odsRoute.id });
  const ods = odsQueries.useOne({
    id: params.odsId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;

  return ods ? (
    <>
      {/* TODO: replace this with real content */}
      <Text as="strong">Id</Text>
      <Text>{ods.id}</Text>
    </>
  ) : null;
};
