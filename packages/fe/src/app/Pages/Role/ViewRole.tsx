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
import { roleQueries } from '../../api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { roleRoute, roleIndexRoute } from '../../routes';

export const ViewRole = () => {
  const params = useParams({ from: roleRoute.id });
  const role = roleQueries.useOne({
    id: params.roleId,
    tenantId: params.asId,
  }).data;

  return role ? (
    <>
      {/* TODO: replace this with real content */}
      <FormLabel as="p">Id</FormLabel>
      <Text>{role.id}</Text>
    </>
  ) : null;
};
