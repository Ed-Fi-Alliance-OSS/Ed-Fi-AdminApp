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
import { userTenantMembershipQueries } from '../../api';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  userTenantMembershipRoute,
  userTenantMembershipIndexRoute,
} from '../../routes';

export const ViewUserTenantMembership = () => {
  const params = useParams({ from: userTenantMembershipRoute.id });
  const userTenantMembership = userTenantMembershipQueries.useOne({
    id: params.userTenantMembershipId,
    tenantId: params.asId,
  }).data;

  return userTenantMembership ? (
    <>
      {/* TODO: replace this with real content */}
      <FormLabel as="p">Id</FormLabel>
      <Text>{userTenantMembership.id}</Text>
    </>
  ) : null;
};
