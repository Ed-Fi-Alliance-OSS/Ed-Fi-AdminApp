import { ChakraProvider } from '@chakra-ui/react';
import { theme } from '@edanalytics/common-ui';
import {
  QueryClient,
  QueryClientProvider,
  useQueryErrorResetBoundary,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from 'react-error-boundary';
import { Routes } from './routes';
import { FeedbackBannerProvider } from './Layout/FeedbackBanner';

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  },
});

function App() {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <FeedbackBannerProvider>
      <ChakraProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary onReset={reset} fallbackRender={({ resetErrorBoundary, error }) => error}>
            <Routes />
            <ReactQueryDevtools initialIsOpen={false} position="bottom-left" />
          </ErrorBoundary>
        </QueryClientProvider>
      </ChakraProvider>
    </FeedbackBannerProvider>
  );
}

export default App;
