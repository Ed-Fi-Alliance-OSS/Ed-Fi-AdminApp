import { Box, Flex, HStack, Text, VStack } from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import { Outlet } from 'react-router-dom';
import { useMe } from '../api';
import { AppBar } from './AppBar';
import { AppBarPublic } from './AppBarPublic';
import { Breadcrumbs } from './Breadcrumbs';
import { Nav } from './Nav';
import { FeedbackBanners } from './FeedbackBanner';

export const StandardLayout = () => {
  const queryClient = useQueryClient();
  const me = useMe();
  const isLoggedIn = !!me.data;
  const hasRole = !!me.data?.role;

  queryClient.setDefaultOptions({
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  });
  return (
    <VStack spacing={0} h="100vh" overflow="hidden">
      {isLoggedIn ? <AppBar /> : <AppBarPublic />}
      <HStack as="main" w="100%" flex="auto 1 1" align="start" overflow="hidden" spacing={0}>
        {hasRole ? (
          <>
            <Nav />
            <Box maxH="100%" h="100%" overflow="auto" flexGrow="1">
              <Flex flexDir="column" minW="35em" h="100%">
                <FeedbackBanners />
                <Box p={3} px="calc(4vw + 0.5em)">
                  <Breadcrumbs mb={5} />
                  <Box flexGrow={1} pb="2em">
                    <Outlet />
                  </Box>
                </Box>
              </Flex>
            </Box>
          </>
        ) : isLoggedIn ? (
          <Box w="100%" pt="30vh" textAlign="center">
            <VStack
              borderRadius="4px"
              border="1px solid"
              borderColor="gray.400"
              py="5em"
              pb="6em"
              px="6em"
              maxW="70em"
              display="inline-flex"
              align="left"
              textAlign="left"
              spacing="4em"
            >
              <Text w="auto" textAlign="center" fontWeight="bold" fontSize="5xl" color="gray.400">
                We found you in our database, but you don't have a role assigned yet.
              </Text>
            </VStack>
          </Box>
        ) : null}
      </HStack>
    </VStack>
  );
};
