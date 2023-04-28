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
import { useSbe } from '../../api';
import { sbeRoute } from '../../routes/sbe.routes';

export const ViewSbe = () => {
  const sbeId: string = useParams({ from: sbeRoute.id }).sbeId;
  const sbe = useSbe(sbeId).data;

  return sbe ? (
    <>
      {/* TODO: replace this with real content */}
      <Text as="strong">Id</Text>
      <Text>{sbe.id}</Text>
    </>
  ) : null;
};
