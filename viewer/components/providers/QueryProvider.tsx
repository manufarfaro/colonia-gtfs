'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * Single TanStack Query client per tab. Defaults:
 *
 * - `retry: false` — our backend already returns sanitized 4xx/5xx with
 *   structured errors; auto-retry would spam OTP/bridge unnecessarily.
 * - `refetchOnWindowFocus: false` — for v0 the polling cadence
 *   (every 15-30s while active) is enough; focus-refetch would create
 *   redundant traffic.
 * - `staleTime: 60_000` — data is considered fresh for a minute by
 *   default. Hooks that need real-time (vehicles, arrivals) override
 *   this via `refetchInterval`.
 */
export function QueryProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
            staleTime: 60_000,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
