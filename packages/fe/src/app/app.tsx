import { ChakraProvider } from '@chakra-ui/react';
import { theme } from '@edanalytics/common-ui';
import {
  QueryClient,
  QueryClientProvider,
  useQueryErrorResetBoundary,
} from '@tanstack/react-query';
import { Routes } from './routes';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from 'react-error-boundary';
import { environment } from '../environments/environment.local';

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
    <ChakraProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ resetErrorBoundary, error }) => error}
        >
          <Routes />
          {environment.production ? null : (
            <ReactQueryDevtools initialIsOpen={false} position="bottom-left" />
          )}
        </ErrorBoundary>
      </QueryClientProvider>
    </ChakraProvider>
  );
}

export default App;
