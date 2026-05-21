import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * Builds a fresh QueryClient + QueryClientProvider wrapper for use with
 * @testing-library/react's `renderHook({ wrapper })` option. The client
 * disables retries so a single mocked fetch is enough per test.
 */
export function makeQueryWrapper(): {
  Wrapper: ({ children }: { children: ReactNode }) => React.ReactElement;
  client: QueryClient;
} {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }): React.ReactElement => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, client };
}
