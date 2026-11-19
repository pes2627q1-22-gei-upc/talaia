import type { Esdeveniment } from '@talaia/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { ApiError, apiGet, apiPost, apiPut } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { asPointResponse } from '@/features/point/__fixtures__/point';

import { type NewPlanParams, useNewPlanViewModel } from '../useNewPlanViewModel';
import { plan } from '../__fixtures__/plan';
import { planCalendarRepository } from '../planCalendarRepository';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPut: jest.fn(),
}));
jest.mock('../planCalendarRepository', () => ({
  ...jest.requireActual('../planCalendarRepository'),
  planCalendarRepository: {
    isSupported: jest.fn(() => false),
    requestCalendars: jest.fn(),
    createEvent: jest.fn(),
  },
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
  jest.mocked(apiPut).mockReset();
  jest.mocked(apiPut).mockResolvedValue(undefined);
  jest.mocked(planCalendarRepository.isSupported).mockReturnValue(false);
  jest.mocked(planCalendarRepository.requestCalendars).mockReset();
  jest.mocked(planCalendarRepository.requestCalendars).mockResolvedValue({
    status: 'ready',
    calendars: [
      { id: 'google', title: 'Personal', account: 'Google' },
      { id: 'local', title: 'Local', account: 'Mòbil' },
    ],
  });
  jest.mocked(planCalendarRepository.createEvent).mockReset();
  jest.mocked(planCalendarRepository.createEvent).mockResolvedValue('native-event-1');
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

describe('calendari del mòbil (TG-158)', () => {
  async function enabled() {
    jest.mocked(planCalendarRepository.isSupported).mockReturnValue(true);
    post.mockResolvedValue(plan);
    const vm = await renderVm();
    await act(() => vm.result.current.calendar.onChange(true));
    await waitFor(() => expect(vm.result.current.calendar.target).not.toBeNull());
    return vm;
  }

  it('desa el pla abans de crear l’esdeveniment al calendari triat, i retorna en acabar', async () => {
    const { result } = await enabled();
    await act(() => result.current.calendarSheet.options[1]!.onPress());
    await act(() => result.current.save.onPress());
    await waitFor(() => expect(back).toHaveBeenCalled());
    expect(post).toHaveBeenCalledTimes(1);
    expect(planCalendarRepository.createEvent).toHaveBeenCalledWith(
      'local',
      expect.objectContaining({
        title: 'Talaia · Serra del Montsec',
        startDate: plan.dataHoraInici,
      }),
    );
    expect(post.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(planCalendarRepository.createEvent).mock.invocationCallOrder[0]!,
    );
    expect(apiPut).toHaveBeenCalledWith('/plans/plan-1/calendari', {
      calendariEventId: 'native-event-1',
    });
  });

  it('si el pla no es desa, no crea cap esdeveniment natiu', async () => {
    const { result } = await enabled();
    post.mockRejectedValueOnce(new Error('offline'));
    await act(() => result.current.save.onPress());
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(planCalendarRepository.createEvent).not.toHaveBeenCalled();
    expect(result.current.saved).toBeNull();
  });

  it('un error de calendari conserva el pla i el reintent no repeteix el POST', async () => {
    const { result } = await enabled();
    jest
      .mocked(planCalendarRepository.createEvent)
      .mockRejectedValueOnce(new Error('calendar gone'));
    await act(() => result.current.save.onPress());
    await waitFor(() => expect(result.current.saved?.busy).toBe(false));
    expect(result.current.saved?.message).toBe(i18n.t('plans.calendar.syncErrors.create'));
    expect(back).not.toHaveBeenCalled();
    await act(() => result.current.saved?.retry.onPress());
    await waitFor(() => expect(back).toHaveBeenCalled());
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('un error del vincle reintenta el PUT, sense repetir ni pla ni esdeveniment', async () => {
    const { result } = await enabled();
    jest.mocked(apiPut).mockRejectedValueOnce(new Error('offline'));
    await act(() => result.current.save.onPress());
    await waitFor(() => expect(result.current.saved?.busy).toBe(false));
    expect(result.current.saved?.message).toBe(i18n.t('plans.calendar.syncErrors.link'));
    await act(() => result.current.saved?.retry.onPress());
    await waitFor(() => expect(back).toHaveBeenCalled());
    expect(post).toHaveBeenCalledTimes(1);
    expect(planCalendarRepository.createEvent).toHaveBeenCalledTimes(1);
    expect(apiPut).toHaveBeenCalledTimes(2);
  });

  it('es pot desactivar l’opció després de denegar permisos i desar només el pla', async () => {
    jest.mocked(planCalendarRepository.isSupported).mockReturnValue(true);
    jest
      .mocked(planCalendarRepository.requestCalendars)
      .mockResolvedValue({ status: 'denied', canAskAgain: false });
    post.mockResolvedValue(plan);
    const { result } = await renderVm();
    await act(() => result.current.calendar.onChange(true));
    await waitFor(() =>
      expect(result.current.calendar.error).toBe(i18n.t('plans.calendar.denied')),
    );
    expect(result.current.save.disabled).toBe(true);
    expect(result.current.calendar.action?.label).toBe(i18n.t('plans.calendar.settings'));
    await act(() => result.current.calendar.onChange(false));
    await act(() => result.current.save.onPress());
    await waitFor(() => expect(back).toHaveBeenCalled());
    expect(planCalendarRepository.createEvent).not.toHaveBeenCalled();
  });
});
