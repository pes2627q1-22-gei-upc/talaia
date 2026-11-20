import type { ConsultaRecomanacions } from '@talaia/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { apiGet } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { useCalendarEventsQuery } from '@/features/calendar/calendarRepository';
import { useMapPointsQuery } from '@/features/map/mapRepository';
import { usePointDetailQuery } from '@/features/point/pointRepository';
import { useRecommendationsQuery } from '@/features/recommendations/recommendationsRepository';

jest.mock('@/core/api/httpClient', () => ({ apiGet: jest.fn() }));

const search: ConsultaRecomanacions = {
  objectiu: 'pluja_estels',
  origen: { lat: 41.98, lon: 2.82 },
  data: '2026-11-16',
  desDe: 22,
  finsA: 6,
  tempsMaxim: 150,
};

it('renova les dades en canviar d’idioma i reutilitza només la mateixa llengua', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  await i18n.changeLanguage('ca');
  jest.mocked(apiGet).mockImplementation(async () => ({
    nom: i18n.language,
    data: [],
    features: [{ properties: { nom: i18n.language } }],
    index: { actual: null, properesHores: [] },
  }));
  const { result } = await renderHook(
    () => ({
      map: useMapPointsQuery(),
      point: usePointDetailQuery('one'),
      calendar: useCalendarEventsQuery({ year: 2026, month: 11 }),
      recommendations: useRecommendationsQuery(search),
    }),
    { wrapper: Wrapper },
  );
  await waitFor(() => expect(result.current.point.data?.nom).toBe('ca'));
  await waitFor(() => expect(result.current.map.data?.features[0]?.properties.nom).toBe('ca'));
  for (const language of ['es', 'en']) {
    await act(() => i18n.changeLanguage(language));
    await waitFor(() => expect(result.current.point.data?.nom).toBe(language));
    expect(result.current.map.data?.features[0]?.properties.nom).toBe(language);
    await waitFor(() =>
      expect(client.getQueryData(['calendar', language, 2026, 11])).toBeDefined(),
    );
    await waitFor(() =>
      expect(client.getQueryData(['recommendations', search, language])).toBeDefined(),
    );
  }
  const calls = jest.mocked(apiGet).mock.calls.length;
  await act(() => i18n.changeLanguage('ca'));
  expect(result.current.point.data?.nom).toBe('ca');
  expect(result.current.map.data?.features[0]?.properties.nom).toBe('ca');
  expect(apiGet).toHaveBeenCalledTimes(calls);
  await cleanup();
  client.clear();
});
