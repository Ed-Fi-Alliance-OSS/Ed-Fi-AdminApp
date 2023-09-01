import { Button, HStack, Image } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import logoUrl from '../../assets/starting-blocks.svg';

export const AppBarPublic = () => {
  return (
    <HStack
      zIndex={2}
      as="header"
      justify="space-between"
      w="100%"
      position="sticky"
      top="0px"
      bg="white"
      borderBottom="1px solid"
      borderColor="gray.200"
      boxShadow="md"
      py={1}
      px={3}
    >
      <RouterLink to="/">
        <Image h={7} src={logoUrl} />
      </RouterLink>
      <Button variant="solid" colorScheme="blue" as={RouterLink} to="/login">
        Log in
      </Button>
    </HStack>
  );
};
