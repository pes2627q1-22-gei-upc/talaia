import type { Favorit } from '@talaia/shared';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { apiGet, apiPost } from '@/core/api/httpClient';

export const favoritesKey = (language: string) => ['favorits', language] as const;

export const favoritesRepository = {
  list(signal?: AbortSignal): Promise<Favorit[]> {
    return apiGet<Favorit[]>('/favorits', undefined, { signal });
  },
  add(puntId: string): Promise<Favorit> {
    return apiPost<Favorit>('/favorits', { puntId });
  },
};

/** La llista es comparteix amb «Els meus favorits» (TG-171). */
export function useFavoritesQuery(enabled: boolean) {
  const { i18n } = useTranslation();
  return useQuery({
    queryKey: favoritesKey(i18n.resolvedLanguage ?? 'ca'),
    queryFn: ({ signal }) => favoritesRepository.list(signal),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}
