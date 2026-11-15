import type { Esdeveniment, EsdevenimentDetall, EsdevenimentsResponse } from '@talaia/shared';
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiGet } from '@/core/api/httpClient';

export const eventKeys = {
  detail: (eventId: string, language: string) =>
    ['esdeveniments', 'detail', eventId, language] as const,
};

/** El detall de l'API, o l'esdeveniment del calendari mentre arriba (sense `horari` ni `explicacio`). */
export type EventData = Esdeveniment & Partial<Pick<EsdevenimentDetall, 'horari' | 'explicacio'>>;

/** `GET /api/v1/esdeveniments/{id}` (TG-138), amb els textos en l'idioma de l'app. */
export function fetchEvent(eventId: string, language: string, signal?: AbortSignal) {
  return apiGet<EsdevenimentDetall>(`/esdeveniments/${encodeURIComponent(eventId)}`, undefined, {
    signal,
    headers: { 'Accept-Language': language },
  });
}

/** L'esdeveniment que ja ha baixat el calendari. */
function fromCalendar(client: QueryClient, eventId: string): EventData | undefined {
  for (const [, data] of client.getQueriesData<EsdevenimentsResponse>({
    queryKey: ['calendar'],
  })) {
    const event = data?.data.find((item) => item.id === eventId);
    if (event) return event;
  }
  return undefined;
}

export function useEventQuery(eventId: string, language: string) {
  const client = useQueryClient();
  const query = useQuery<EventData>({
    queryKey: eventKeys.detail(eventId, language),
    queryFn: ({ signal }) => fetchEvent(eventId, language, signal),
    // La fitxa s'obre a l'instant amb el calendari i el detall la completa quan arriba.
    placeholderData: () => fromCalendar(client, eventId),
    // Com el calendari: les dades astronòmiques no canvien d'un moment a l'altre.
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  // Si el detall falla, val més la fitxa del calendari que un error.
  return {
    ...query,
    data: query.data ?? (query.isError ? fromCalendar(client, eventId) : undefined),
  };
}
