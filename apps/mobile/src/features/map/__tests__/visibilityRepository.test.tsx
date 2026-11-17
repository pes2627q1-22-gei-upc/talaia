import type { VisibilitatUbicacio } from '@talaia/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { ApiError, apiGet } from '@/core/api/httpClient';

import { type Spot, useVisibilityQuery } from '../visibilityRepository';

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

  it('demana la cel·la de 0,01° i un segon toc a la mateixa cel·la surt de la memòria', async () => {
    mockedApiGet.mockResolvedValue(response);
    const first = await renderHook(() => useVisibilityQuery({ lat: 42.0112, lon: 1.3089 }), {
      wrapper: QueryWrapper,
    });
    await waitFor(() => expect(first.result.current.data).toEqual(response));
    expect(mockedApiGet).toHaveBeenCalledWith('/visibilitat', { lat: 42.01, lon: 1.31 });

    const second = await renderHook(() => useVisibilityQuery({ lat: 42.0089, lon: 1.3132 }), {
      wrapper: QueryWrapper,
    });
    expect(second.result.current.data).toEqual(response);
    expect(mockedApiGet).toHaveBeenCalledTimes(1);
  });

  it('no reintenta sol: cada consulta compta per al límit horari', async () => {
    mockedApiGet.mockRejectedValue(new ApiError(503, 'meteo_unavailable', 'Open-Meteo no respon'));
    const spot: Spot = { lat: 41.5, lon: 2 };
    const { result } = await renderHook(() => useVisibilityQuery(spot), { wrapper: QueryWrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockedApiGet).toHaveBeenCalledTimes(1);
  });
});
