import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './httpClient';

/** Memòria cau de dades remotes compartida per tots els Repository. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Un 4xx no es resol reintentant; un error de xarxa o un 5xx, potser sí.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
});
