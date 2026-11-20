import type { PlaNou } from '@talaia/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { ApiError, apiGet, apiPost, apiPut } from '@/core/api/httpClient';
import i18n from '@/core/i18n';

import {
  fetchEventsBetween,
  fetchPlanEvents,
  PLANS_KEY,
  plansRepository,
  useEventsBetweenQuery,
  usePlansQuery,
} from '../plansRepository';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPut: jest.fn(),
}));
const get = jest.mocked(apiGet);
const post = jest.mocked(apiPost);

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

it('crea el pla amb POST /plans i el cos exacte', async () => {
  const plan: PlaNou = {
    puntId: 'montsec',
    esdevenimentId: null,
    dataHoraInici: '2026-10-21T21:15:00.000Z',
    calendariEventId: null,
    notes: null,
  };
  post.mockResolvedValue({ id: 'p1' });
  await expect(plansRepository.create(plan)).resolves.toEqual({ id: 'p1' });
  expect(post).toHaveBeenCalledWith('/plans', plan);
});

it("propaga l'ApiError del POST perquè el ViewModel en triï el missatge", async () => {
  const error = new ApiError(409, 'plan_limit_reached', 'Com a molt pots tenir 20 plans pendents');
  post.mockRejectedValue(error);
  await expect(
    plansRepository.create({ puntId: 'montsec', dataHoraInici: '2026-10-21T21:15:00.000Z' }),
  ).rejects.toBe(error);
});

it("propaga l'error de GET /plans", async () => {
  const error = new ApiError(503, 'database_unavailable', '');
  get.mockRejectedValue(error);
  await expect(plansRepository.list('futurs')).rejects.toBe(error);
});

it('la clau dels plans és la que invalidarà «Els meus plans»', () => {
  expect(PLANS_KEY).toEqual(['plans']);
});

it('vincula l’esdeveniment del calendari al pla existent amb un PUT idempotent', async () => {
  jest.mocked(apiPut).mockResolvedValue(undefined);
  await plansRepository.linkCalendar('p1', { calendariEventId: 'event-1' });
  expect(apiPut).toHaveBeenCalledWith('/plans/p1/calendari', { calendariEventId: 'event-1' });
});

it('demana els fenòmens del dia triat ± 1', async () => {
  get.mockResolvedValue({ data: [] });
  const controller = new AbortController();
  await fetchPlanEvents('2026-10-21', controller.signal);
  expect(get).toHaveBeenCalledWith(
    '/esdeveniments',
    { des_de: '2026-10-20', fins_a: '2026-10-22' },
    { signal: controller.signal },
  );
});

it('llista els plans futurs o passats amb GET /plans?quan=', async () => {
  get.mockResolvedValue([]);
  await plansRepository.list('futurs');
  expect(get).toHaveBeenCalledWith('/plans', { quan: 'futurs' }, { signal: undefined });
  await plansRepository.list('passats');
  expect(get).toHaveBeenLastCalledWith('/plans', { quan: 'passats' }, { signal: undefined });
});

it("demana d'una vegada els fenòmens dels dies dels plans", async () => {
  get.mockResolvedValue({ data: [] });
  await fetchEventsBetween('2026-10-21', '2026-11-02');
  expect(get).toHaveBeenCalledWith(
    '/esdeveniments',
    { des_de: '2026-10-21', fins_a: '2026-11-02' },
    { signal: undefined },
  );
});

describe('consultes de «Els meus plans»', () => {
  const wrapper = () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    const Wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, Wrapper };
  };

  beforeEach(async () => {
    await i18n.changeLanguage('ca');
  });

  it('per defecte demana la llista, amb una clau per llista i per idioma sota PLANS_KEY', async () => {
    get.mockResolvedValue([]);
    const { client, Wrapper } = wrapper();
    const { result } = await renderHook(() => usePlansQuery('futurs'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith('/plans', { quan: 'futurs' }, expect.anything());
    expect(client.getQueryCache().find({ queryKey: [...PLANS_KEY, 'futurs', 'ca'] })).toBeDefined();
  });

  it('sense cap pla amb fenomen (interval null), no demana els fenòmens', async () => {
    const { Wrapper } = wrapper();
    const { result } = await renderHook(() => useEventsBetweenQuery(null), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(get).not.toHaveBeenCalled();
  });
});
