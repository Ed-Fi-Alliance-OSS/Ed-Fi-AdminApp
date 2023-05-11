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
import { sbeQueries } from '../../api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { sbeRoute, sbeIndexRoute } from '../../routes';

export const ViewSbe = () => {
  const params = useParams({ from: sbeRoute.id });
  const sbe = sbeQueries.useOne({
    id: params.sbeId,
    tenantId: params.asId,
  }).data;

  return sbe ? (
    <>
      {/* TODO: replace this with real content */}
      <FormLabel as="p">Id</FormLabel>
      <Text>{sbe.id}</Text>
    </>
  ) : null;
};
