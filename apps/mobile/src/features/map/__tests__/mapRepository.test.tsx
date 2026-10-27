import type { PuntsMapaGeoJson } from '@talaia/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { apiGet } from '@/core/api/httpClient';

import { fetchMapPoints, useMapPointsQuery } from '../mapRepository';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
}));
const mockedApiGet = jest.mocked(apiGet);

const points: PuntsMapaGeoJson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0.75, 42.05] },
      properties: {
        id: 'montsec',
        nom: 'Montsec',
        municipi: 'Àger',
        index: { valor: 85, franja: 'ras', deDia: false },
      },
    },
  ],
};

describe('mapRepository', () => {
  let client: QueryClient;
  function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  beforeEach(() => mockedApiGet.mockReset());
  afterEach(async () => {
    await cleanup();
    client.clear();
    jest.restoreAllMocks();
  });

  it('descarrega el GeoJSON complet sense filtre de coordenades', async () => {
    mockedApiGet.mockResolvedValue(points);
    await expect(fetchMapPoints()).resolves.toEqual(points);
    expect(mockedApiGet).toHaveBeenCalledWith('/punts');
  });

  it('reutilitza els punts en tornar al mapa i els renova després del canvi d’hora', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(Date.parse('2026-10-16T10:45:00Z'));
    mockedApiGet.mockResolvedValue(points);
    const wrapper = QueryWrapper;
    const first = await renderHook(() => useMapPointsQuery(), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    expect(first.result.current.data).toEqual(points);
    await first.unmount();

    now.mockReturnValue(Date.parse('2026-10-16T10:59:59Z'));
    const second = await renderHook(() => useMapPointsQuery(), { wrapper });
    expect(second.result.current.data).toEqual(points);
    expect(mockedApiGet).toHaveBeenCalledTimes(1);
    await second.unmount();

    now.mockReturnValue(Date.parse('2026-10-16T11:00:00Z'));
    const updated: PuntsMapaGeoJson = { type: 'FeatureCollection', features: [] };
    mockedApiGet.mockResolvedValue(updated);
    const third = await renderHook(() => useMapPointsQuery(), { wrapper });
    await waitFor(() => expect(third.result.current.data).toEqual(updated));
    expect(mockedApiGet).toHaveBeenCalledTimes(2);
  });

  it('accepta un catàleg buit', async () => {
    mockedApiGet.mockResolvedValue({ type: 'FeatureCollection', features: [] });
    const { result } = await renderHook(() => useMapPointsQuery(), {
      wrapper: QueryWrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.features).toEqual([]);
  });

  it('exposa els errors de l’API', async () => {
    const error = new Error('xarxa');
    mockedApiGet.mockRejectedValue(error);
    const { result } = await renderHook(() => useMapPointsQuery(), {
      wrapper: QueryWrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
  });

  it('revalida el catàleg buit després de 30 segons i conserva els punts recuperats', async () => {
    const now = jest.spyOn(Date, 'now');
    const start = Date.parse('2026-10-16T10:45:00Z');
    now.mockReturnValue(start);
    mockedApiGet.mockResolvedValue({ type: 'FeatureCollection', features: [] });
    const first = await renderHook(() => useMapPointsQuery(), { wrapper: QueryWrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    await first.unmount();
    now.mockReturnValue(start + 29_000);
    const second = await renderHook(() => useMapPointsQuery(), { wrapper: QueryWrapper });
    expect(mockedApiGet).toHaveBeenCalledTimes(1);
    await second.unmount();
    now.mockReturnValue(start + 30_000);
    mockedApiGet.mockResolvedValue(points);
    const third = await renderHook(() => useMapPointsQuery(), { wrapper: QueryWrapper });
    await waitFor(() => expect(third.result.current.data).toEqual(points));
    expect(mockedApiGet).toHaveBeenLastCalledWith('/punts', undefined, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    await third.unmount();
    now.mockReturnValue(start + 60_000);
    await renderHook(() => useMapPointsQuery(), { wrapper: QueryWrapper });
    expect(mockedApiGet).toHaveBeenCalledTimes(2);
  });

  it('permet reintentar el catàleg buit abans dels 30 segons i revalida HTTP', async () => {
    mockedApiGet
      .mockResolvedValueOnce({ type: 'FeatureCollection', features: [] })
      .mockResolvedValue(points);
    const { result } = await renderHook(() => useMapPointsQuery(), { wrapper: QueryWrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.features).toEqual([]);
    await act(async () => {
      const refreshed = await result.current.refetch();
      expect(refreshed.data).toEqual(points);
    });
    expect(mockedApiGet).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.data).toEqual(points));
    expect(mockedApiGet).toHaveBeenLastCalledWith('/punts', undefined, {
      headers: { 'Cache-Control': 'no-cache' },
    });
  });
});
