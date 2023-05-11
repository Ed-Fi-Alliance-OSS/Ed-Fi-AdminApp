import { Box, Flex, HStack, VStack } from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import { Outlet } from '@tanstack/router';
import React from 'react';
import { AppBar } from './AppBar';
import { Breadcrumbs } from './Breadcrumbs';
import { Nav } from './Nav';

export const StandardLayout = () => {
  const queryClient = useQueryClient();
  const [err, setErr] = React.useState<null | any>(null);
  if (err) {
    throw err;
  }

  queryClient.setDefaultOptions({
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: false,
      onError: (err) => {
        setErr(err);
      },
    },
  });
  return (
    <VStack spacing={0} h="100vh" overflow="hidden">
      <AppBar />
      <HStack
        as="main"
        w="100%"
        flex="auto 1 1"
        align="start"
        overflow="hidden"
        spacing={0}
      >
        <Nav />
        <Box
          p={3}
          px="calc(3vw + 0.5em)"
          maxH="100%"
          h="100%"
          overflow="auto"
          flexGrow="1"
        >
          <Flex flexDir="column" minW="35em" h="100%">
            <Breadcrumbs mb={3} />
            <Box flexGrow={1}>
              <Outlet />
            </Box>
          </Flex>
        </Box>
      </HStack>
    </VStack>
  );
};
