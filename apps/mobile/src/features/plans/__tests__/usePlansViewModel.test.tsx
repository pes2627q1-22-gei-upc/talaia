import type { Esdeveniment, Pla } from '@talaia/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { ApiError, apiGet } from '@/core/api/httpClient';
import i18n from '@/core/i18n';

import { plan } from '../__fixtures__/plans';
import { PLANS_KEY } from '../plansRepository';
import { usePlansViewModel } from '../usePlansViewModel';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
}));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

const get = jest.mocked(apiGet);
const push = jest.fn();
const navigate = jest.fn();
jest
  .mocked(useRouter)
  .mockReturnValue({ push, navigate } as unknown as ReturnType<typeof useRouter>);

const orionides = { id: 'orionides-2026', nom: 'Oriònides' } as Esdeveniment;

const upcoming: Pla[] = [
  plan({ id: 'p1', esdevenimentId: 'orionides-2026' }),
  plan({
    id: 'p2',
    punt: { id: 'garraf', nom: 'Mirador de la Morella', municipi: 'El Garraf', publicat: true },
    dataHoraInici: '2026-11-02T00:00:00.000Z',
  }),
];
const past: Pla[] = [
  plan({
    id: 'p0',
    punt: { id: 'prades', nom: 'Coll de Prades', municipi: 'Prades', publicat: false },
    dataHoraInici: '2026-10-08T19:00:00.000Z',
  }),
];

type Lists = { futurs?: Pla[] | Error; passats?: Pla[] | Error };

/** Com l'API: les dues llistes de plans i els fenòmens. */
function respond(lists: Lists = { futurs: upcoming, passats: past }) {
  return (async (path: string, query?: Record<string, unknown>) => {
    if (path === '/esdeveniments') return { data: [orionides] };
    const list = lists[query?.quan as 'futurs' | 'passats'];
    if (list instanceof Error) throw list;
    return list ?? [];
  }) as typeof apiGet;
}

const plansCalls = (quan: string) =>
  get.mock.calls.filter(([path, query]) => path === '/plans' && query?.quan === quan).length;

async function renderVm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => usePlansViewModel(), { wrapper });
  return { ...hook, client };
}

beforeEach(async () => {
  get.mockReset();
  get.mockImplementation(respond());
  push.mockReset();
  navigate.mockReset();
  await i18n.changeLanguage('ca');
});

it('carrega els propers amb el nom del fenomen i la sortida, sense demanar els passats', async () => {
  const { result } = await renderVm();
  expect(result.current.upcoming.state).toBe('loading');
  await waitFor(() => expect(result.current.upcoming.state).toBe('ready'));
  expect(result.current.title).toBe('Els meus plans');
  expect(result.current.upcoming.rows).toEqual([
    expect.objectContaining({
      id: 'p1',
      day: '21',
      month: 'OCT',
      title: 'Oriònides a Àger',
      subtitle: 'Sortida a les 23:15, Serra del Montsec',
      retired: false,
      accessibilityLabel: "Oriònides a Àger. 21 d'octubre. Sortida a les 23:15, Serra del Montsec",
    }),
    expect.objectContaining({
      id: 'p2',
      day: '02',
      month: 'NOV',
      title: 'Cel estrellat al Garraf',
      subtitle: 'Sortida a la 01:00, Mirador de la Morella',
    }),
  ]);
  expect(get).toHaveBeenCalledWith(
    '/esdeveniments',
    { des_de: '2026-10-21', fins_a: '2026-10-21' },
    expect.anything(),
  );
  expect(plansCalls('passats')).toBe(0);
  expect(result.current.tabs.map((tab) => [tab.label, tab.selected])).toEqual([
    ['Propers', true],
    ['Passats', false],
  ]);
});

it('els passats es demanen en obrir-los; un punt retirat no obre la fitxa', async () => {
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.upcoming.state).toBe('ready'));
  await act(async () => result.current.tabs[1]!.onSelect());
  expect(result.current.tab).toBe('passats');
  await waitFor(() => expect(result.current.past.state).toBe('ready'));
  const row = result.current.past.rows[0]!;
  expect(row).toMatchObject({
    title: 'Cel estrellat a Prades',
    subtitle: 'Aquest punt ja no està disponible.',
    retired: true,
    accessibilityHint: undefined,
  });
  result.current.onOpen(row);
  expect(push).not.toHaveBeenCalled();
});

it('obrir un pla porta a la fitxa del seu punt', async () => {
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.upcoming.state).toBe('ready'));
  result.current.onOpen(result.current.upcoming.rows[0]!);
  expect(push).toHaveBeenCalledWith({ pathname: '/punt/[id]', params: { id: 'montsec' } });
});

it('sense plans, el buit porta a Explora', async () => {
  get.mockImplementation(respond({ futurs: [] }));
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.upcoming.state).toBe('empty'));
  expect(result.current.upcoming.empty.title).toBe('Encara no tens cap pla');
  // Sense cap fenomen, no cal demanar-ne cap.
  expect(get).not.toHaveBeenCalledWith('/esdeveniments', expect.anything(), expect.anything());
  result.current.create.onPress();
  expect(navigate).toHaveBeenCalledWith('/');
});

it('un error es pot tornar a provar', async () => {
  get.mockImplementation(respond({ futurs: new ApiError(500, 'internal', 'boom') }));
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.upcoming.state).toBe('error'));
  expect(result.current.error).toEqual({
    title: 'No hem pogut carregar els plans',
    retryLabel: 'Torna-ho a provar',
  });
  get.mockImplementation(respond());
  await act(async () => result.current.upcoming.retry());
  await waitFor(() => expect(result.current.upcoming.state).toBe('ready'));
});

it('si els fenòmens no arriben, la llista surt igualment sense els noms', async () => {
  get.mockImplementation((async (path: string, query?: Record<string, unknown>) => {
    if (path === '/esdeveniments') throw new Error('xarxa');
    return respond()(path, query as never);
  }) as typeof apiGet);
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.upcoming.state).toBe('ready'));
  expect(result.current.upcoming.rows[0]!.title).toBe('Cel estrellat a Àger');
});

it('crear un pla (invalidar PLANS_KEY) refresca les llistes ja carregades', async () => {
  const { result, client } = await renderVm();
  await waitFor(() => expect(result.current.upcoming.state).toBe('ready'));
  await act(async () => result.current.tabs[1]!.onSelect());
  await waitFor(() => expect(result.current.past.state).toBe('ready'));
  const before = { futurs: plansCalls('futurs'), passats: plansCalls('passats') };
  await act(() => client.invalidateQueries({ queryKey: PLANS_KEY }));
  expect(plansCalls('futurs')).toBe(before.futurs + 1);
  expect(plansCalls('passats')).toBe(before.passats + 1);
});
