import { Box, VStack } from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import { Outlet } from '@tanstack/router';
import React from 'react';
import { useMe } from '../api';
import { AppBar } from './AppBar';
import { AppBarPublic } from './AppBarPublic';

export const PublicAppLayout = () => {
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
  const me = useMe();

  return (
    <VStack spacing={0} h="100vh" overflow="hidden" align="start">
      {me.data === null ? <AppBarPublic /> : <AppBar />}
      <Box overflow="auto" p={3} minW="35em" h="100%" w="100%">
        <Outlet />
      </Box>
    </VStack>
  );
};
