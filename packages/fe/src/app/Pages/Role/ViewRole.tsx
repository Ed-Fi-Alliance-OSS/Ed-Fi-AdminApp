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
import { useRole } from '../../api';
import { roleRoute } from '../../routes';

export const ViewRole = () => {
  const params = useParams({ from: roleRoute.id });
  const role = useRole(params.roleId).data;

  return role ? (
    <>
      {/* TODO: replace this with real content */}
      <Text as="strong">Id</Text>
      <Text>{role.id}</Text>
    </>
  ) : null;
};
