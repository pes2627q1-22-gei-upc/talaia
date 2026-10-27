import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

/**
 * Proveïdor de TanStack Query per a tests de Repository i ViewModel: sense reintents
 * (un error es veu de seguida) i amb una memòria cau nova a cada test.
 */
export function createQueryWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
