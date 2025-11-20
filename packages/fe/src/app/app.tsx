import { Box, ChakraProvider, Spinner } from '@chakra-ui/react';
import { theme } from '@edanalytics/common-ui';
import {
  QueryClient,
  QueryClientProvider,
  useIsFetching,
  useIsMutating,
  useQueryClient,
  useQueryErrorResetBoundary,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from 'react-error-boundary';
import { FeedbackBannerProvider } from './Layout/FeedbackBanner';
import { Routes } from './routes';
import { useEffect } from 'react';
import { useMe } from './api';

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  },
});

const MutationIndicator = () => {
  const isMutating = !!useIsMutating();
  const isFetching = !!(useIsFetching() - useIsFetching({ queryKey: ['authorizations'] }));
  const queryClient = useQueryClient();
  const me = useMe();
  useEffect(() => {
    // The most common real-world trigger is probably CUD on team memberships or the global role. So refetch all auth caches.
    queryClient.invalidateQueries({ queryKey: ['auth-cache'] });
  }, [me.data, queryClient]);

  return (
    <Box
      zIndex={2}
      pos="absolute"
      bottom="1.25em"
      left="0.25em"
      display={isMutating || isFetching ? 'initial' : 'none'}
    >
      <Spinner color="gray.500" size="sm" />
    </Box>
  );
};

function App() {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <QueryClientProvider client={queryClient}>
      <FeedbackBannerProvider>
        <ChakraProvider theme={theme}>
          <MutationIndicator />
          <ErrorBoundary onReset={reset} fallbackRender={({ resetErrorBoundary, error }) => error}>
            <Routes />
          </ErrorBoundary>
        </ChakraProvider>
      </FeedbackBannerProvider>
      <ReactQueryDevtools initialIsOpen={false} position="bottom" />
    </QueryClientProvider>
  );
}

export default App;
