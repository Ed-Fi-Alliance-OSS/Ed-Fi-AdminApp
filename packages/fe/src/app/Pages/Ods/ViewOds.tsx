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
import { useOds } from '../../api';
import { odsRoute } from '../../routes';

export const ViewOds = () => {
  const params = useParams({ from: odsRoute.id });
  const ods = useOds(params.odsId, params.sbeId).data;

  return ods ? (
    <>
      {/* TODO: replace this with real content */}
      <Text as="strong">Id</Text>
      <Text>{ods.id}</Text>
    </>
  ) : null;
};
