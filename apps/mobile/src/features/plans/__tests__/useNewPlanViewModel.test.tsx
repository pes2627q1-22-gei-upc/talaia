import type { Esdeveniment } from '@talaia/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { ApiError, apiGet, apiPost } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { asPointResponse } from '@/features/point/__fixtures__/point';

import { type NewPlanParams, useNewPlanViewModel } from '../useNewPlanViewModel';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('expo-haptics');

const get = jest.mocked(apiGet);
const post = jest.mocked(apiPost);
const back = jest.fn();
jest.mocked(useRouter).mockReturnValue({ back } as unknown as ReturnType<typeof useRouter>);

const event = (overrides: Partial<Esdeveniment>): Esdeveniment =>
  ({
    id: 'orionides-2026',
    tipus: 'pluja_estels',
    nom: 'Oriònides',
    inici: '2026-10-02T00:00:00Z',
    fi: '2026-11-07T00:00:00Z',
    maxim: '2026-10-21T20:00:00Z',
    descripcio: '',
    ubicacio: 'global',
    font: 'IMO',
    ...overrides,
  }) as Esdeveniment;
const orionides = event({});
const llunaPlena = event({
  id: 'lluna-plena-2026-10-26',
  tipus: 'fase_llunar',
  nom: 'Lluna plena',
  inici: '2026-10-26T04:12:00Z',
  fi: '2026-10-26T04:12:00Z',
  maxim: null,
});

/** Com l'API: la fitxa del punt o els fenòmens de la finestra demanada. */
function respond(events: Esdeveniment[] = [orionides, llunaPlena]) {
  return async (path: string, query?: Record<string, unknown>) => {
    if (path === '/esdeveniments') {
      const from = String(query?.des_de);
      const to = String(query?.fins_a);
      return {
        data: events.filter((e) => e.inici.slice(0, 10) <= to && e.fi.slice(0, 10) >= from),
      };
    }
    return asPointResponse();
  };
}

/** Dimecres 21 d'octubre de 2026 a les 18:07 (hora de Catalunya, `jest.timezone.js`). */
const NOW = new Date(2026, 9, 21, 18, 7);

async function renderVm(params: Partial<NewPlanParams> = {}) {
  const client = new QueryClient({
    // Sense `gcTime` a les mutacions, en queda un temporitzador de 5 minuts i Jest no surt.
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(
    () => useNewPlanViewModel({ puntId: 'montsec', inici: '2026-10-21T21:15:00Z', ...params }),
    { wrapper },
  );
  return { ...hook, invalidate };
}

beforeEach(async () => {
  // Només es fixa el rellotge: TanStack Query continua amb els temporitzadors reals.
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
      'performance',
      'hrtime',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
    ],
  });
  get.mockReset();
  get.mockImplementation(respond() as typeof apiGet);
  post.mockReset();
  back.mockReset();
  await i18n.changeLanguage('ca');
});

afterEach(() => {
  jest.useRealTimers();
});

it('arrenca amb el punt de la fitxa i la millor franja com a hora de sortida', async () => {
  // El punt arriba quan el test ho diu: si no, pot ser a la memòria cau abans del primer `expect`.
  let resolvePoint: (value: unknown) => void = () => undefined;
  const events = respond();
  get.mockImplementation(((path: string, query?: Record<string, unknown>) =>
    path === '/esdeveniments'
      ? events(path, query)
      : new Promise<unknown>((resolve) => {
          resolvePoint = resolve;
        })) as typeof apiGet);
  const { result } = await renderVm();
  expect(result.current.point.loading).toBe(true);
  await act(async () => resolvePoint(asPointResponse()));
  await waitFor(() => expect(result.current.point.name).toBe('Serra del Montsec'));
  expect(result.current.header).toBe('Nou pla');
  expect(result.current.title).toBe("Pla d'observació");
  expect(result.current.point.accessibilityLabel).toBe(
    "Punt d'observació: Serra del Montsec, Àger",
  );
  expect(result.current.day.value).toBe("Dc. 21 d'oct.");
  expect(result.current.time.value).toBe('23:15');
  expect(result.current.event.value).toBe('Cap en concret');
  expect(result.current.save).toMatchObject({ label: 'Desa el pla', disabled: false });
  expect(result.current.pastMessage).toBeUndefined();
});

it('sense franja de la fitxa, surt a les 22:00', async () => {
  const { result } = await renderVm({ inici: undefined });
  expect(result.current.time.value).toBe('22:00');
});

it("desactiva el botó si l'hora de sortida ja ha passat", async () => {
  const { result } = await renderVm();
  await act(async () => {
    result.current.time.onPress();
    result.current.timeSheet.onHourChange(17);
  });
  expect(result.current.save.disabled).toBe(true);
  expect(result.current.pastMessage).toBe(
    "L'hora de sortida ja ha passat. Tria'n una de més tard.",
  );
});

it("torna a mirar l'hora en enviar: amb la pantalla oberta, pot haver passat", async () => {
  const { result } = await renderVm();
  const save = result.current.save.onPress;
  jest.setSystemTime(new Date(2026, 9, 21, 23, 20));
  await act(async () => save());
  expect(post).not.toHaveBeenCalled();
  expect(result.current.pastMessage).toBeDefined();
  expect(result.current.save.disabled).toBe(true);
});

it('envia el punt, la sortida en UTC, el fenomen i les notes', async () => {
  post.mockResolvedValue({ id: 'p1' });
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.eventSheet.status).toBe('ok'));
  expect(result.current.eventSheet.options.map((option) => option.label)).toEqual([
    'Cap en concret',
    "Pluja d'estels: Oriònides",
  ]);
  await act(async () => {
    result.current.eventSheet.options[1]!.onPress();
    result.current.notes.onChange('  Frontal vermell ');
  });
  expect(result.current.event.value).toBe("Pluja d'estels: Oriònides");
  await act(async () => result.current.save.onPress());
  expect(post).toHaveBeenCalledWith('/plans', {
    puntId: 'montsec',
    esdevenimentId: 'orionides-2026',
    dataHoraInici: '2026-10-21T21:15:00.000Z',
    dataHoraFi: null,
    calendariEventId: null,
    notes: 'Frontal vermell',
  });
});

it('sense fenomen ni notes, envia null', async () => {
  post.mockResolvedValue({ id: 'p1' });
  const { result } = await renderVm({ inici: undefined });
  await act(async () => result.current.save.onPress());
  expect(post).toHaveBeenCalledWith('/plans', {
    puntId: 'montsec',
    esdevenimentId: null,
    dataHoraInici: '2026-10-21T20:00:00.000Z',
    dataHoraFi: null,
    calendariEventId: null,
    notes: null,
  });
});

it('amb el final de la franja, envia dataHoraFi i en conserva la durada si es mou la sortida', async () => {
  post.mockResolvedValue({ id: 'p1' });
  const { result } = await renderVm({ fi: '2026-10-22T00:00:00Z' });
  await act(async () => {
    result.current.time.onPress();
    result.current.timeSheet.onHourChange(22);
  });
  await act(async () => result.current.save.onPress());
  expect(post).toHaveBeenCalledWith(
    '/plans',
    expect.objectContaining({
      dataHoraInici: '2026-10-21T20:15:00.000Z',
      dataHoraFi: '2026-10-21T23:00:00.000Z',
    }),
  );
});

it('no envia dues vegades amb un doble toc', async () => {
  post.mockReturnValue(new Promise(() => undefined));
  const { result } = await renderVm();
  await act(async () => {
    result.current.save.onPress();
    result.current.save.onPress();
  });
  await waitFor(() =>
    expect(result.current.save).toMatchObject({ label: 'Desant…', disabled: true }),
  );
  await act(async () => result.current.save.onPress());
  expect(post).toHaveBeenCalledTimes(1);
});

it.each([
  ['plan_already_exists', 409, 'Ja tens un pla en aquest punt a aquesta hora.'],
  ['plan_limit_reached', 409, 'Has arribat al màxim de 20 plans pendents.'],
  ['punt_not_found', 422, 'Aquest punt ja no està disponible.'],
  // El fenomen surt de la llista de /esdeveniments: si l'API no el troba, el missatge genèric.
  ['event_not_found', 422, "No hem pogut desar el pla. Torna-ho a provar d'aquí a un moment."],
  ['validation_error', 400, "No hem pogut desar el pla. Torna-ho a provar d'aquí a un moment."],
])('%s → «%s»', async (code, status, message) => {
  post.mockRejectedValue(new ApiError(status, code, ''));
  const { result } = await renderVm();
  await act(async () => result.current.save.onPress());
  await waitFor(() => expect(result.current.error).toBe(message));
  expect(back).not.toHaveBeenCalled();
  // Es pot tornar a provar.
  expect(result.current.save.disabled).toBe(false);
});

it('un compte bloquejat no mostra cap error: ho fa AccountBlockedScreen', async () => {
  post.mockRejectedValue(new ApiError(403, 'account_blocked', ''));
  const { result } = await renderVm();
  await act(async () => result.current.save.onPress());
  await waitFor(() => expect(result.current.save.disabled).toBe(false));
  expect(result.current.error).toBeUndefined();
  expect(back).not.toHaveBeenCalled();
});

it('canviar els minuts esborra l’error anterior i mou la sortida', async () => {
  post.mockRejectedValueOnce(new ApiError(409, 'plan_already_exists', ''));
  const { result } = await renderVm();
  await act(async () => result.current.save.onPress());
  await waitFor(() => expect(result.current.error).toBeDefined());
  await act(async () => result.current.timeSheet.onMinuteChange(45));
  expect(result.current.error).toBeUndefined();
  expect(result.current.time.value).toBe('23:45');
  expect(result.current.timeSheet.minute).toBe(45);
});

it('cada camp obre el seu full i el tanca', async () => {
  const { result } = await renderVm();
  const visibles = () => [
    result.current.dateSheet.visible,
    result.current.timeSheet.visible,
    result.current.eventSheet.visible,
  ];
  expect(visibles()).toEqual([false, false, false]);
  for (const [open, close, expected] of [
    [() => result.current.day.onPress(), () => result.current.dateSheet.onClose(), 0],
    [() => result.current.time.onPress(), () => result.current.timeSheet.onClose(), 1],
    [() => result.current.event.onPress(), () => result.current.eventSheet.onClose(), 2],
  ] as const) {
    await act(async () => open());
    expect(visibles().map((visible, index) => visible === (index === expected))).toEqual([
      true,
      true,
      true,
    ]);
    await act(async () => close());
    expect(visibles()).toEqual([false, false, false]);
  }
});

it('el calendari del full porta el títol del mes i el nom de cada dia', async () => {
  const { result } = await renderVm();
  const { dateSheet } = result.current;
  expect(dateSheet.max).toBe('2027-10-21');
  expect(dateSheet.firstDay).toBe(1);
  expect(dateSheet.formatTitle({ year: 2026, month: 9 })).toBe('octubre de 2026');
  expect(dateSheet.dayLabel('2026-10-05')).toBe("5 d'octubre");
});

it('en anglès, la setmana del calendari comença en diumenge', async () => {
  await i18n.changeLanguage('en');
  const { result } = await renderVm();
  expect(result.current.dateSheet.firstDay).toBe(0);
});

it('si els fenòmens no arriben, el full ho diu i es pot tornar a provar', async () => {
  get.mockImplementation((async (path: string, query?: Record<string, unknown>) => {
    if (path === '/esdeveniments') throw new Error('xarxa');
    return respond()(path, query);
  }) as typeof apiGet);
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.eventSheet.status).toBe('error'));
  expect(result.current.eventSheet.errorMessage).toBeTruthy();

  get.mockImplementation(respond() as typeof apiGet);
  await act(async () => result.current.eventSheet.retry());
  await waitFor(() => expect(result.current.eventSheet.status).toBe('ok'));
  expect(result.current.eventSheet.options).toHaveLength(2);
});

it('«Cap en concret» treu el fenomen triat', async () => {
  const { result } = await renderVm({ esdevenimentId: 'orionides-2026' });
  await waitFor(() => expect(result.current.event.value).toBe("Pluja d'estels: Oriònides"));
  await act(async () => result.current.eventSheet.options[0]!.onPress());
  expect(result.current.event.value).toBe('Cap en concret');
  expect(result.current.eventSheet.options[0]?.selected).toBe(true);
});

it("en desar, invalida els plans i torna a la pantalla d'abans", async () => {
  post.mockResolvedValue({ id: 'p1' });
  const { result, invalidate } = await renderVm();
  await act(async () => result.current.save.onPress());
  await waitFor(() => expect(back).toHaveBeenCalled());
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['plans'] });
});

it('en canviar el dia, treu el fenomen que hi queda fora i manté el que encara hi és', async () => {
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.eventSheet.status).toBe('ok'));
  await act(async () => result.current.eventSheet.options[1]!.onPress());

  await act(async () => result.current.dateSheet.onChange('2026-10-25'));
  expect(result.current.event.value).toBe("Pluja d'estels: Oriònides");
  expect(result.current.day.value).toBe("Dg. 25 d'oct.");

  await waitFor(() => expect(result.current.eventSheet.options).toHaveLength(3));
  await act(async () => result.current.eventSheet.options[2]!.onPress());
  expect(result.current.event.value).toBe('Fase lunar: Lluna plena');

  await act(async () => result.current.dateSheet.onChange('2026-10-21'));
  expect(result.current.event.value).toBe('Cap en concret');
});

it('el fenomen dels paràmetres surt triat quan arriba la llista', async () => {
  const { result } = await renderVm({ esdevenimentId: 'orionides-2026' });
  await waitFor(() => expect(result.current.event.value).toBe("Pluja d'estels: Oriònides"));
  expect(result.current.eventSheet.options[1]?.selected).toBe(true);
});

it('el calendari comença avui i enfosqueix els dies passats', async () => {
  const { result } = await renderVm();
  expect(result.current.dateSheet).toMatchObject({
    today: '2026-10-21',
    min: '2026-10-21',
    dimPastDays: true,
    value: '2026-10-21',
  });
});
