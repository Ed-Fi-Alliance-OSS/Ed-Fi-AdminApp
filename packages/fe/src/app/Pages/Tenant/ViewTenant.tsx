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
import { useTenant } from '../../api';
import { tenantRoute } from '../../routes';

export const ViewTenant = () => {
  const params = useParams({ from: tenantRoute.id });
  const tenant = useTenant(params.tenantId).data;

  return tenant ? (
    <>
      {/* TODO: replace this with real content */}
      <Text as="strong">Id</Text>
      <Text>{tenant.id}</Text>
    </>
  ) : null;
};
