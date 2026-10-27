import { act, renderHook, waitFor } from '@testing-library/react-native';

import { apiGet } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { useApiStatusViewModel } from '../useApiStatusViewModel';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
}));
const mockedApiGet = jest.mocked(apiGet);

function renderViewModel() {
  return renderHook(() => useApiStatusViewModel(), { wrapper: createQueryWrapper() });
}

describe('useApiStatusViewModel', () => {
  beforeEach(async () => {
    mockedApiGet.mockReset();
    await i18n.changeLanguage('ca');
  });

  it('mentre carrega, diu que està comprovant i no ofereix reintentar', async () => {
    mockedApiGet.mockReturnValue(new Promise(() => undefined));
    const { result } = await renderViewModel();
    expect(result.current.status).toBe('loading');
    expect(result.current.message).toBe('Comprovant la connexió…');
    expect(result.current.canRetry).toBe(false);
  });

  it("amb resposta, mostra la versió de l'API", async () => {
    mockedApiGet.mockResolvedValue({ status: 'ok', version: '0.1.0' });
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(result.current.message).toBe('Connectat · API v0.1.0');
  });

  it('amb error, ho diu i permet tornar-ho a provar', async () => {
    mockedApiGet.mockRejectedValueOnce(new Error('xarxa'));
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.message).toBe('No es pot connectar amb el servidor');
    expect(result.current.canRetry).toBe(true);

    mockedApiGet.mockResolvedValueOnce({ status: 'ok', version: '0.1.0' });
    await act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ok'));
  });

  it("tradueix els textos a la llengua de l'app", async () => {
    mockedApiGet.mockResolvedValue({ status: 'ok', version: '0.1.0' });
    await i18n.changeLanguage('en');
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(result.current.title).toBe('Server status');
  });
});
