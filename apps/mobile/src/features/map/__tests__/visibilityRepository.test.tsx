import type { VisibilitatUbicacio } from '@talaia/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { ApiError, apiGet } from '@/core/api/httpClient';

import { millisecondsUntilNextHour, type Spot, useVisibilityQuery } from '../visibilityRepository';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
}));
const mockedApiGet = jest.mocked(apiGet);

const response: VisibilitatUbicacio = {
  lat: 42.01,
  lon: 1.31,
  sqm: null,
  deDia: false,
  index: {
    valor: 64,
    franja: 'jus',
    hora: '2026-11-16T20:00:00Z',
    foscorEstimada: true,
    factors: { nuvols: 0.8, foscor: 0.9, lluna: 0.9, sol: 1 },
  },
};

describe('visibilityRepository', () => {
  let client: QueryClient;
  function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  beforeEach(() => {
    client = new QueryClient();
    mockedApiGet.mockReset();
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
  });

  it('no demana res fins que hi ha un lloc', async () => {
    const { result } = await renderHook(() => useVisibilityQuery(null), { wrapper: QueryWrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedApiGet).not.toHaveBeenCalled();
  });

  it('envia el lloc tal com s’ha tocat, i el mateix lloc surt de la memòria', async () => {
    // L'API mira si és a Catalunya abans d'arrodonir: (41.3251, 2.1851) hi és, la cel·la
    // (41.33, 2.19) no.
    mockedApiGet.mockResolvedValue(response);
    const spot: Spot = { lat: 41.3251, lon: 2.1851 };
    const first = await renderHook(() => useVisibilityQuery(spot), { wrapper: QueryWrapper });
    await waitFor(() => expect(first.result.current.data).toEqual(response));
    expect(mockedApiGet).toHaveBeenCalledWith('/visibilitat', { lat: 41.3251, lon: 2.1851 });

    const second = await renderHook(() => useVisibilityQuery({ ...spot }), {
      wrapper: QueryWrapper,
    });
    expect(second.result.current.data).toEqual(response);
    expect(mockedApiGet).toHaveBeenCalledTimes(1);
  });

  it('amb la targeta oberta, en canviar d’hora torna a demanar l’índex', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-16T20:59:00Z') });
    try {
      const next = { ...response, index: { ...response.index, hora: '2026-11-16T21:00:00Z' } };
      mockedApiGet.mockResolvedValueOnce(response).mockResolvedValueOnce(next);
      const { result } = await renderHook(() => useVisibilityQuery({ lat: 42.0112, lon: 1.3089 }), {
        wrapper: QueryWrapper,
      });
      await act(() => jest.advanceTimersByTimeAsync(0));
      expect(result.current.data).toEqual(response);

      await act(() => jest.advanceTimersByTimeAsync(60_000));
      expect(mockedApiGet).toHaveBeenCalledTimes(1);
      await act(() => jest.advanceTimersByTimeAsync(30_000));
      expect(mockedApiGet).toHaveBeenCalledTimes(2);
      await waitFor(() => expect(result.current.data).toEqual(next));
    } finally {
      jest.useRealTimers();
    }
  });

  it('el canvi d’hora porta 30 s de marge', () => {
    expect(millisecondsUntilNextHour(Date.parse('2026-11-16T20:59:00Z'))).toBe(90_000);
    expect(millisecondsUntilNextHour(Date.parse('2026-11-16T21:00:00Z'))).toBe(3_630_000);
  });

  it('no reintenta sol: cada consulta compta per al límit horari', async () => {
    mockedApiGet.mockRejectedValue(new ApiError(503, 'meteo_unavailable', 'Open-Meteo no respon'));
    const spot: Spot = { lat: 41.5, lon: 2 };
    const { result } = await renderHook(() => useVisibilityQuery(spot), { wrapper: QueryWrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockedApiGet).toHaveBeenCalledTimes(1);
  });
});
