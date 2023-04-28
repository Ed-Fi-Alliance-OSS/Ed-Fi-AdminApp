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
import { useParams } from '@tanstack/router';
import { useUserTenantMembership } from '../../api';
import { userTenantMembershipRoute } from '../../routes';

export const ViewUserTenantMembership = () => {
  const params = useParams({ from: userTenantMembershipRoute.id });
  const userTenantMembership = useUserTenantMembership(
    params.userTenantMembershipId
  ).data;

  return userTenantMembership ? (
    <>
      {/* TODO: replace this with real content */}
      <Text as="strong">Id</Text>
      <Text>{userTenantMembership.id}</Text>
    </>
  ) : null;
};
