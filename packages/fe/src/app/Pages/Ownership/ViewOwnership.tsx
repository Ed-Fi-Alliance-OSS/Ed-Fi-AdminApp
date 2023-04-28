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
import { useOwnership } from '../../api';
import { ownershipRoute } from '../../routes';

export const ViewOwnership = () => {
  const params = useParams({ from: ownershipRoute.id });
  const ownership = useOwnership(params.ownershipId).data;

  return ownership ? (
    <>
      {/* TODO: replace this with real content */}
      <Text as="strong">Id</Text>
      <Text>{ownership.id}</Text>
    </>
  ) : null;
};
