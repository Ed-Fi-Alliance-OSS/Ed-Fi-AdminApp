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
import { useEdorg } from '../../api';
import { edorgRoute } from '../../routes';

export const ViewEdorg = () => {
  const params = useParams({ from: edorgRoute.id });
  const edorg = useEdorg(params.edorgId, params.sbeId).data;

  return edorg ? (
    <>
      {/* TODO: replace this with real content */}
      <Text as="strong">Id</Text>
      <Text>{edorg.id}</Text>
    </>
  ) : null;
};
