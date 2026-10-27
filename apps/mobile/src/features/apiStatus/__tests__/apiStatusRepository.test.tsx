import { renderHook, waitFor } from '@testing-library/react-native';

import { apiGet } from '@/core/api/httpClient';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { fetchHealth, useHealthQuery } from '../apiStatusRepository';

// Es simula només el client HTTP: el Repository es prova tal com és.
jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
}));
const mockedApiGet = jest.mocked(apiGet);

describe('apiStatusRepository', () => {
  beforeEach(() => mockedApiGet.mockReset());

  it('fetchHealth crida GET /health', async () => {
    mockedApiGet.mockResolvedValue({ status: 'ok', version: '0.1.0' });
    await expect(fetchHealth()).resolves.toEqual({ status: 'ok', version: '0.1.0' });
    expect(mockedApiGet).toHaveBeenCalledWith('/health');
  });

  it("useHealthQuery exposa les dades de l'API", async () => {
    mockedApiGet.mockResolvedValue({ status: 'ok', version: '0.1.0' });
    const { result } = await renderHook(() => useHealthQuery(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.version).toBe('0.1.0');
  });

  it("useHealthQuery exposa l'error del client", async () => {
    mockedApiGet.mockRejectedValue(new Error('xarxa'));
    const { result } = await renderHook(() => useHealthQuery(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
