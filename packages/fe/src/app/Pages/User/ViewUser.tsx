import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  FormLabel,
  Grid,
  HStack,
  Stack,
  Text,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import { useParams } from '@tanstack/router';
import { useUser, useUsers } from '../../api';
import { userRoute } from '../../routes/user.routes';

export const ViewUser = () => {
  const userId: string = useParams({ from: userRoute.id }).userId;
  const user = useUser(userId).data;

  return user ? (
    <>
      <FormLabel as="p">Given Name</FormLabel>
      <Text color="gray.600">{user.givenName}</Text>
      <FormLabel as="p">Family Name</FormLabel>
      <Text color="gray.600">{user.familyName}</Text>
    </>
  ) : null;
};
