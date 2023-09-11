import { Box, ChakraProvider, Spinner } from '@chakra-ui/react';
import { theme } from '@edanalytics/common-ui';
import {
  QueryClient,
  QueryClientProvider,
  useIsFetching,
  useIsMutating,
  useQueryErrorResetBoundary,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from 'react-error-boundary';
import { FeedbackBannerProvider } from './Layout/FeedbackBanner';
import { Routes } from './routes';

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
    <FeedbackBannerProvider>
      <ChakraProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <MutationIndicator />
          <ErrorBoundary onReset={reset} fallbackRender={({ resetErrorBoundary, error }) => error}>
            <Routes />
            <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
          </ErrorBoundary>
        </QueryClientProvider>
      </ChakraProvider>
    </FeedbackBannerProvider>
  );
}

export default App;
