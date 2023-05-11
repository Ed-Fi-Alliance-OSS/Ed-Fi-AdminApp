import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  Grid,
  HStack,
  Stack,
  Text,
  Tooltip,
  FormLabel,
  VStack,
} from '@chakra-ui/react';
import { useParams, useSearch } from '@tanstack/router';
import { ownershipQueries } from '../../api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ownershipRoute, ownershipIndexRoute } from '../../routes';

export const ViewOwnership = () => {
  const params = useParams({ from: ownershipRoute.id });
  const ownership = ownershipQueries.useOne({
    id: params.ownershipId,
    tenantId: params.asId,
  }).data;

  return ownership ? (
    <>
      {/* TODO: replace this with real content */}
      <FormLabel as="p">Id</FormLabel>
      <Text>{ownership.id}</Text>
    </>
  ) : null;
};
