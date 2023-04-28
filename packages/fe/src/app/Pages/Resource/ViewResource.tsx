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
import { useResource } from '../../api';
import { resourceRoute } from '../../routes';

export const ViewResource = () => {
  const params = useParams({ from: resourceRoute.id });
  const resource = useResource(params.resourceId).data;

  return resource ? (
    <>
      {/* TODO: replace this with real content */}
      <Text as="strong">Id</Text>
      <Text>{resource.id}</Text>
    </>
  ) : null;
};
