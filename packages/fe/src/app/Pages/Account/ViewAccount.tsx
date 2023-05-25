import { FormLabel, Text } from '@chakra-ui/react';
import { roleQueries, useMe } from '../../api';

export const ViewAccount = () => {
  const me = useMe();
  const user = me.data;

  return user ? (
    <>
      <FormLabel as="strong">Username</FormLabel>
      <Text>{user.username}</Text>
      <FormLabel as="strong">Global role</FormLabel>
      <Text>{user.roleId}</Text>
    </>
  ) : null;
};
