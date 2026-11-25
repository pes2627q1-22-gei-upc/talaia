import type { Esdeveniment, Pla } from '@talaia/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { ApiError, apiDelete, apiGet } from '@/core/api/httpClient';
import i18n from '@/core/i18n';

import { plan } from '../__fixtures__/plans';
import { planCalendarRepository } from '../planCalendarRepository';
import { PLANS_KEY } from '../plansRepository';
import { usePlansViewModel } from '../usePlansViewModel';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
  apiDelete: jest.fn(),
}));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../planCalendarRepository', () => ({
  planCalendarRepository: { deleteEvent: jest.fn() },
}));

const del = jest.mocked(apiDelete);
const deleteEvent = jest.mocked(planCalendarRepository.deleteEvent);

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
  del.mockReset();
  del.mockResolvedValue(undefined);
  deleteEvent.mockReset();
  deleteEvent.mockResolvedValue(true);
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
      month: 'oct.',
      title: 'Oriònides a Àger',
      subtitle: 'Sortida a les 23:15, Serra del Montsec',
      retired: false,
      accessibilityLabel: "Oriònides a Àger. 21 d'octubre. Sortida a les 23:15, Serra del Montsec",
    }),
    expect.objectContaining({
      id: 'p2',
      day: '02',
      month: 'nov.',
      title: 'Cel estrellat al Garraf',
      subtitle: 'Sortida a la 01:00, Mirador de la Morella',
    }),
  ]);
  expect(get).toHaveBeenCalledWith(
    '/esdeveniments',
    { des_de: '2026-10-20', fins_a: '2026-10-22' },
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

it('en tornar a «Propers», els passats es queden carregats, i un invalidate els refresca', async () => {
  const { result, client } = await renderVm();
  await waitFor(() => expect(result.current.upcoming.state).toBe('ready'));
  await act(async () => result.current.tabs[1]!.onSelect());
  await waitFor(() => expect(result.current.past.state).toBe('ready'));
  await act(async () => result.current.tabs[0]!.onSelect());
  expect(result.current.tab).toBe('futurs');
  expect(result.current.tabs.map((tab) => tab.selected)).toEqual([true, false]);
  expect(result.current.past.rows).toHaveLength(1);
  expect(plansCalls('passats')).toBe(1);

  // Tornar a «Passats» no els torna a demanar: la consulta no s'ha desactivat (`pastRequested`).
  await act(async () => result.current.tabs[1]!.onSelect());
  expect(result.current.past.state).toBe('ready');
  expect(plansCalls('passats')).toBe(1);

  // Des de «Propers», crear un pla (invalidar PLANS_KEY) també refresca els passats.
  await act(async () => result.current.tabs[0]!.onSelect());
  const before = plansCalls('passats');
  await act(() => client.invalidateQueries({ queryKey: PLANS_KEY }));
  expect(plansCalls('passats')).toBe(before + 1);
});

it('mentre arriben els noms dels fenòmens, la llista surt amb esquelets', async () => {
  let resolveEvents: (value: unknown) => void = () => undefined;
  get.mockImplementation((async (path: string, query?: Record<string, unknown>) =>
    path === '/esdeveniments'
      ? new Promise<unknown>((resolve) => {
          resolveEvents = resolve;
        })
      : respond()(path, query as never)) as typeof apiGet);
  const { result } = await renderVm();
  await waitFor(() => expect(plansCalls('futurs')).toBe(1));
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith('/esdeveniments', expect.anything(), expect.anything()),
  );
  expect(result.current.upcoming).toMatchObject({ state: 'loading', rows: [] });
  await act(async () => resolveEvents({ data: [orionides] }));
  await waitFor(() => expect(result.current.upcoming.state).toBe('ready'));
  expect(result.current.upcoming.rows[0]!.title).toBe('Oriònides a Àger');
});

it('un error dels passats no afecta els propers', async () => {
  get.mockImplementation(respond({ futurs: upcoming, passats: new ApiError(500, 'internal', '') }));
  const { result } = await renderVm();
  await act(async () => result.current.tabs[1]!.onSelect());
  await waitFor(() => expect(result.current.past.state).toBe('error'));
  await waitFor(() => expect(result.current.upcoming.state).toBe('ready'));
  expect(result.current.past.empty.title).toBeTruthy();
});

it('obrir una fila que ja no és a cap llista no fa res', async () => {
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.upcoming.state).toBe('ready'));
  result.current.onOpen({ id: 'no-hi-es' });
  expect(push).not.toHaveBeenCalled();
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

it("un pla de les 23:15 per a un eclipsi de les 02:00 de l'endemà en porta el nom", async () => {
  const eclipse = { id: 'eclipsi-2026', nom: 'Eclipsi de Lluna' } as Esdeveniment;
  get.mockImplementation((async (path: string, query?: Record<string, unknown>) => {
    // Com l'API: només torna l'eclipsi (22/10, hora de Catalunya) si la consulta l'inclou.
    if (path === '/esdeveniments') {
      const q = query as { des_de: string; fins_a: string };
      return { data: q.des_de <= '2026-10-22' && '2026-10-22' <= q.fins_a ? [eclipse] : [] };
    }
    return query?.quan === 'futurs' ? [plan({ esdevenimentId: 'eclipsi-2026' })] : [];
  }) as typeof apiGet);
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.upcoming.state).toBe('ready'));
  expect(result.current.upcoming.rows[0]!.title).toBe('Eclipsi de Lluna a Àger');
});

it.each([
  ['es', 'Cielo estrellado en el Garraf', 'Cielo estrellado en la Ràpita'],
  ['en', 'Starry sky in el Garraf', 'Starry sky in la Ràpita'],
])(
  "en %s, l'article del municipi queda en minúscula, com en català",
  async (lng, garraf, rapita) => {
    await i18n.changeLanguage(lng);
    const place = (id: string, municipi: string) =>
      plan({ id, punt: { id, nom: 'Mirador', municipi, publicat: true } });
    get.mockImplementation(
      respond({ futurs: [place('g', 'El Garraf'), place('r', 'la Ràpita')], passats: [] }),
    );
    const { result } = await renderVm();
    await waitFor(() => expect(result.current.upcoming.state).toBe('ready'));
    expect(result.current.upcoming.rows.map((row) => row.title)).toEqual([garraf, rapita]);
  },
);

describe('eliminar un pla (HU15, TG-162)', () => {
  const linked = plan({ id: 'p1', esdevenimentId: 'orionides-2026', calendariEventId: 'event-1' });

  async function openDeletion(lists: Lists = { futurs: [linked, upcoming[1]!], passats: past }) {
    get.mockImplementation(respond(lists));
    const vm = await renderVm();
    await waitFor(() => expect(vm.result.current.upcoming.state).toBe('ready'));
    expect(vm.result.current.deletion.visible).toBe(false);
    await act(() => vm.result.current.onDelete({ id: 'p1' }));
    return vm;
  }

  it("demana confirmació amb el títol del pla i esmenta el calendari si n'hi ha", async () => {
    const { result } = await openDeletion();
    expect(result.current.deletion).toMatchObject({
      visible: true,
      title: 'Vols eliminar el pla?',
      message:
        '«Oriònides a Àger» desapareixerà dels teus plans i, si encara hi és, del calendari del mòbil.',
      confirmLabel: 'Elimina',
      cancelLabel: 'Cancel·la',
      disabled: false,
    });
    expect(result.current.upcoming.rows[0]!.deleteLabel).toBe('Elimina «Oriònides a Àger»');
    expect(del).not.toHaveBeenCalled();
  });

  it("sense calendari vinculat, el missatge no l'esmenta", async () => {
    const { result } = await openDeletion({ futurs: upcoming, passats: [] });
    expect(result.current.deletion.message).toBe(
      '«Oriònides a Àger» desapareixerà dels teus plans.',
    );
  });

  it("confirmar l'esborra a l'API, després al calendari, i refresca les llistes", async () => {
    const { result, client } = await openDeletion();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    await act(() => result.current.deletion.onConfirm());
    await waitFor(() => expect(result.current.deletion.visible).toBe(false));
    expect(del).toHaveBeenCalledWith('/plans/p1');
    expect(deleteEvent).toHaveBeenCalledWith(linked);
    expect(del.mock.invocationCallOrder[0]!).toBeLessThan(deleteEvent.mock.invocationCallOrder[0]!);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: PLANS_KEY });
  });

  it("si l'API falla, no toca el calendari i el full ho diu", async () => {
    del.mockRejectedValue(new ApiError(500, 'internal', 'boom'));
    const { result } = await openDeletion();
    await act(() => result.current.deletion.onConfirm());
    await waitFor(() =>
      expect(result.current.deletion.message).toBe(
        "No s'ha pogut eliminar el pla. Torna-ho a provar.",
      ),
    );
    expect(result.current.deletion.visible).toBe(true);
    expect(result.current.deletion.disabled).toBe(false);
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it('un 404 vol dir que ja no hi era: compta com a eliminat', async () => {
    del.mockRejectedValue(new ApiError(404, 'plan_not_found', 'no'));
    const { result } = await openDeletion();
    await act(() => result.current.deletion.onConfirm());
    await waitFor(() => expect(result.current.deletion.visible).toBe(false));
    expect(deleteEvent).toHaveBeenCalledWith(linked);
  });

  it('si el calendari falla, el pla queda eliminat i el full ho diu i deixa tornar-ho a provar', async () => {
    deleteEvent.mockRejectedValue(new Error('calendar'));
    const { result, client } = await openDeletion();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    await act(() => result.current.deletion.onConfirm());
    await waitFor(() => expect(result.current.deletion.title).toBe("S'ha eliminat el pla"));
    expect(result.current.deletion).toMatchObject({
      visible: true,
      message:
        "L'esdeveniment, però, continua al calendari del mòbil. Torna-ho a provar o esborra'l des de l'app Calendari.",
      confirmLabel: 'Torna-ho a provar',
      cancelLabel: 'Tanca',
      disabled: false,
    });
    expect(del).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: PLANS_KEY });

    // El segon intent tampoc no va: el full continua obert, i el pla no es torna a esborrar.
    await act(() => result.current.deletion.onConfirm());
    expect(deleteEvent).toHaveBeenCalledTimes(2);
    expect(result.current.deletion.title).toBe("S'ha eliminat el pla");

    deleteEvent.mockResolvedValue(true);
    await act(() => result.current.deletion.onConfirm());
    await waitFor(() => expect(result.current.deletion.visible).toBe(false));
    expect(deleteEvent).toHaveBeenLastCalledWith(linked);
    expect(del).toHaveBeenCalledTimes(1);
  });

  it('si el calendari falla, «Tanca» tanca el full sense tornar-ho a provar', async () => {
    deleteEvent.mockRejectedValue(new Error('calendar'));
    const { result } = await openDeletion();
    await act(() => result.current.deletion.onConfirm());
    await waitFor(() => expect(result.current.deletion.cancelLabel).toBe('Tanca'));
    await act(() => result.current.deletion.onCancel());
    expect(result.current.deletion.visible).toBe(false);
    expect(deleteEvent).toHaveBeenCalledTimes(1);
  });

  it('no trobar l’esdeveniment, o que no sigui el del pla, no és un error', async () => {
    deleteEvent.mockResolvedValue(false);
    const { result } = await openDeletion();
    await act(() => result.current.deletion.onConfirm());
    await waitFor(() => expect(result.current.deletion.visible).toBe(false));
  });

  it('cancel·lar tanca el full sense esborrar res', async () => {
    const { result } = await openDeletion();
    await act(() => result.current.deletion.onCancel());
    expect(result.current.deletion.visible).toBe(false);
    expect(del).not.toHaveBeenCalled();
  });

  it('un pla passat d’un punt retirat també es pot eliminar', async () => {
    get.mockImplementation(respond());
    const { result } = await renderVm();
    await waitFor(() => expect(result.current.upcoming.state).toBe('ready'));
    await act(() => result.current.tabs[1]!.onSelect());
    await waitFor(() => expect(result.current.past.state).toBe('ready'));
    await act(() => result.current.onDelete({ id: 'p0' }));
    await act(() => result.current.deletion.onConfirm());
    expect(del).toHaveBeenCalledWith('/plans/p0');
  });
});
