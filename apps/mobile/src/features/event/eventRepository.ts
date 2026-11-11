import type { Esdeveniment, EsdevenimentsResponse } from '@talaia/shared';
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiGet } from '@/core/api/httpClient';

export const eventKeys = {
  detail: (eventId: string) => ['esdeveniments', 'detail', eventId] as const,
};

/** `GET /api/v1/esdeveniments/{id}` (TG-138): el mateix `Esdeveniment` que la llista. */
export function fetchEvent(eventId: string, signal?: AbortSignal) {
  return apiGet<Esdeveniment>(`/esdeveniments/${encodeURIComponent(eventId)}`, undefined, {
    signal,
  });
}

/** L'esdeveniment que ja ha baixat el calendari: la fitxa s'obre a l'instant, sense esperar. */
function fromCalendar(client: QueryClient, eventId: string) {
  for (const [key, data] of client.getQueriesData<EsdevenimentsResponse>({
    queryKey: ['calendar'],
  })) {
    const event = data?.data.find((item) => item.id === eventId);
    if (event) return { event, updatedAt: client.getQueryState(key)?.dataUpdatedAt };
  }
  return undefined;
}

export function useEventQuery(eventId: string) {
  const client = useQueryClient();
  return useQuery({
    queryKey: eventKeys.detail(eventId),
    queryFn: ({ signal }) => fetchEvent(eventId, signal),
    initialData: () => fromCalendar(client, eventId)?.event,
    initialDataUpdatedAt: () => fromCalendar(client, eventId)?.updatedAt,
    // Com el calendari: les dades astronòmiques no canvien d'un moment a l'altre.
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}
