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
import { userQueries } from '../../api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { userRoute, userIndexRoute } from '../../routes';

export const ViewUser = () => {
  const params = useParams({ from: userRoute.id });
  const user = userQueries.useOne({
    id: params.userId,
    tenantId: params.asId,
  }).data;

  return user ? (
    <>
      <FormLabel as="p">Given Name</FormLabel>
      <Text color="gray.600">{user.givenName}</Text>
      <FormLabel as="p">Family Name</FormLabel>
      <Text color="gray.600">{user.familyName}</Text>
    </>
  ) : null;
};
