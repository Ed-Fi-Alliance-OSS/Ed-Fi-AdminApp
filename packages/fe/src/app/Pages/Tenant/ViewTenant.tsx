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
import { tenantQueries } from '../../api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { tenantRoute, tenantIndexRoute } from '../../routes';

export const ViewTenant = () => {
  const params = useParams({ from: tenantRoute.id });
  const tenant = tenantQueries.useOne({
    id: params.tenantId,
  }).data;

  return tenant ? (
    <>
      {/* TODO: replace this with real content */}
      <FormLabel as="p">Id</FormLabel>
      <Text>{tenant.id}</Text>
    </>
  ) : null;
};
