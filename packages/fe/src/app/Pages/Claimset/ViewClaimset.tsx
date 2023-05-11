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
  VStack,
} from '@chakra-ui/react';
import { useParams, useSearch } from '@tanstack/router';
import { claimsetQueries } from '../../api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { claimsetRoute, claimsetIndexRoute } from '../../routes';

export const ViewClaimset = () => {
  const params = useParams({ from: claimsetRoute.id });
  const claimset = claimsetQueries.useOne({
    id: params.claimsetId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;
  const { edit } = useSearch({ from: claimsetIndexRoute.id });

  return claimset ? (
    <>
      {/* TODO: replace this with real content */}
      <Text as="strong">Id</Text>
      <Text>{claimset.id}</Text>
    </>
  ) : null;
};
