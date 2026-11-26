import type { Pla, PuntsMapaGeoJson } from '@talaia/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { ApiError, apiGet, apiPatch, apiPut } from '@/core/api/httpClient';
import i18n from '@/core/i18n';

import { plan } from '../__fixtures__/plan';
import { planCalendarRepository } from '../planCalendarRepository';
import { PLANS_KEY } from '../plansRepository';
import { useEditPlanViewModel, usePlanLoader } from '../useEditPlanViewModel';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
  apiPatch: jest.fn(),
  apiPut: jest.fn(),
}));
jest.mock('../planCalendarRepository', () => ({
  ...jest.requireActual('../planCalendarRepository'),
  planCalendarRepository: {
    isSupported: jest.fn(() => false),
    requestCalendars: jest.fn(),
    createEvent: jest.fn(),
    eventExists: jest.fn(),
    updateEvent: jest.fn(),
  },
}));
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('expo-haptics');

const get = jest.mocked(apiGet);
const patch = jest.mocked(apiPatch);
const put = jest.mocked(apiPut);
const calendar = jest.mocked(planCalendarRepository);
const back = jest.fn();
const push = jest.fn();
jest.mocked(useRouter).mockReturnValue({ back, push } as unknown as ReturnType<typeof useRouter>);

const POINTS: PuntsMapaGeoJson = {
  type: 'FeatureCollection',
  features: [
    { id: 'prades', nom: 'Coll de Prades', municipi: 'Prades' },
    { id: 'montsec', nom: 'Serra del Montsec', municipi: 'Àger' },
  ].map((properties) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [1, 41] },
    properties: { ...properties, index: null },
  })),
};

/** Dimecres 21 d'octubre de 2026 a les 18:07: el pla de prova (23:15) encara no ha començat. */
const NOW = new Date(2026, 9, 21, 18, 7);

const linked: Pla = { ...plan, calendariEventId: 'native-event-1' };
/** El PATCH respon el pla amb els canvis aplicats, com l'API. */
const saved = (changes: Partial<Pla>): Pla => ({
  ...plan,
  ...changes,
  dataActualitzacio: '2026-10-21T16:07:00.000Z',
});

/** `/punts` es guarda una hora (`useMapPointsQuery`): sense buidar-los, Jest no surt. */
const clients: QueryClient[] = [];

function createClient() {
  const client = new QueryClient({
    // Sense `gcTime` a les mutacions, en queda un temporitzador de 5 minuts i Jest no surt.
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  clients.push(client);
  return client;
}

async function renderVm(initial: Pla = plan) {
  const client = createClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useEditPlanViewModel(initial), { wrapper });
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
  jest.clearAllMocks();
  get.mockImplementation(async (path: string) =>
    path === '/punts' ? POINTS : path.startsWith('/plans/') ? plan : { data: [] },
  );
  patch.mockImplementation(async (_path, body) => saved(body as Partial<Pla>));
  put.mockResolvedValue(undefined);
  calendar.isSupported.mockReturnValue(false);
  await i18n.changeLanguage('ca');
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  jest.useRealTimers();
});

it('omple el formulari amb el pla desat i no deixa desar sense canvis', async () => {
  const { result } = await renderVm();
  expect(result.current.title).toBe('Edita el pla');
  expect(result.current.readOnly).toBe(false);
  expect(result.current.point).toMatchObject({ name: 'Serra del Montsec', error: null });
  expect(result.current.point.link?.label).toBe('Veure el punt');
  expect(result.current.time.value).toBe('23:15');
  expect(result.current.notes.value).toBe('Portar el trípode');
  expect(result.current.save).toMatchObject({ label: 'Desa els canvis', disabled: true });
  // Sense calendari (Expo Go), l'interruptor hi és però desactivat.
  expect(result.current.calendar).toMatchObject({ disabled: true, linkedHint: null });
});

it('«Veure el punt» obre la fitxa del punt', async () => {
  const { result } = await renderVm();
  result.current.point.link!.onPress();
  expect(push).toHaveBeenCalledWith({ pathname: '/punt/[id]', params: { id: 'montsec' } });
});

it('envia només els camps canviats, refresca les llistes i torna enrere', async () => {
  const { result, invalidate } = await renderVm();
  await act(async () => result.current.notes.onChange('Termo'));
  expect(result.current.save?.disabled).toBe(false);
  await act(async () => result.current.save!.onPress());
  await waitFor(() => expect(back).toHaveBeenCalled());
  expect(patch).toHaveBeenCalledTimes(1);
  expect(patch).toHaveBeenCalledWith('/plans/plan-1', { notes: 'Termo' });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: PLANS_KEY });
  expect(put).not.toHaveBeenCalled();
});

it('moure la sortida mou el final i en conserva la durada', async () => {
  const { result } = await renderVm();
  await act(async () => result.current.timeSheet.onMinuteChange(45));
  await act(async () => result.current.save!.onPress());
  await waitFor(() => expect(back).toHaveBeenCalled());
  expect(patch).toHaveBeenCalledWith('/plans/plan-1', {
    dataHoraInici: '2026-10-21T21:45:00.000Z',
    dataHoraFi: '2026-10-22T00:30:00.000Z',
  });
});

it('canviar el dia abans que arribin els fenòmens conserva el del pla', async () => {
  const withEvent = { ...plan, esdevenimentId: 'leonides-2026' };
  get.mockImplementation((path: string) =>
    path === '/esdeveniments' ? new Promise(() => {}) : Promise.resolve(withEvent),
  );
  const { result } = await renderVm(withEvent);
  await act(async () => result.current.dateSheet.onChange('2026-10-22'));
  await act(async () => result.current.save!.onPress());
  await waitFor(() => expect(back).toHaveBeenCalled());
  // Sense `esdevenimentId`: el fenomen desat no es toca.
  expect(patch).toHaveBeenCalledWith('/plans/plan-1', {
    dataHoraInici: '2026-10-22T21:15:00.000Z',
    dataHoraFi: '2026-10-23T00:00:00.000Z',
  });
});

it('un doble toc a «Desa» només envia un PATCH', async () => {
  let resolve: (value: Pla) => void = () => {};
  patch.mockReturnValue(new Promise((done) => (resolve = done)));
  const { result } = await renderVm();
  await act(async () => result.current.notes.onChange('Termo'));
  await act(async () => {
    result.current.save!.onPress();
    result.current.save!.onPress();
  });
  expect(result.current.save?.disabled).toBe(true);
  await act(async () => resolve(saved({ notes: 'Termo' })));
  await waitFor(() => expect(back).toHaveBeenCalled());
  expect(patch).toHaveBeenCalledTimes(1);
});

it.each([
  [new ApiError(409, 'plan_already_exists', 'x'), 'Ja tens un pla en aquest punt a aquesta hora.'],
  [new ApiError(409, 'plan_finished', 'x'), "Aquest pla ja s'ha acabat i no es pot modificar."],
  [new ApiError(422, 'punt_not_found', 'x'), "Aquest punt ja no està disponible; tria'n un altre."],
  [
    new ApiError(422, 'event_not_found', 'x'),
    "Aquest fenomen ja no és al calendari; tria'n un altre.",
  ],
  [new ApiError(404, 'plan_not_found', 'x'), 'Aquest pla ja no existeix.'],
])('mostra l’error del PATCH (%s) i no surt de la pantalla', async (error, message) => {
  patch.mockRejectedValue(error);
  const { result } = await renderVm();
  await act(async () => result.current.notes.onChange('Termo'));
  await act(async () => result.current.save!.onPress());
  await waitFor(() => expect(result.current.error).toBe(message));
  expect(back).not.toHaveBeenCalled();
  // Tornar a editar esborra l'error.
  await act(async () => result.current.notes.onChange('Termo i manta'));
  expect(result.current.error).toBeUndefined();
});

it('un pla acabat s’obre en mode lectura, sense «Desa» ni calendari', async () => {
  const past = { ...plan, dataHoraInici: '2026-10-19T19:00:00.000Z', dataHoraFi: null };
  const { result } = await renderVm(past);
  expect(result.current.readOnly).toBe(true);
  expect(result.current.title).toBe('Pla fet');
  expect(result.current.readOnlyMessage).toBe(
    "Aquest pla ja s'ha acabat: el pots consultar, però no modificar.",
  );
  expect(result.current.save).toBeNull();
  expect(result.current.calendar).toBeNull();
  expect(result.current.point.onPress).toBeUndefined();
});

it('un pla començat es pot desar sense moure la sortida', async () => {
  const started = {
    ...plan,
    dataHoraInici: '2026-10-21T15:00:00.000Z',
    dataHoraFi: '2026-10-21T20:00:00.000Z',
  };
  const { result } = await renderVm(started);
  expect(result.current.pastMessage).toBeUndefined();
  await act(async () => result.current.notes.onChange('Ja hi som'));
  expect(result.current.save?.disabled).toBe(false);
  // Moure-la a una altra hora passada no es pot.
  await act(async () => result.current.timeSheet.onMinuteChange(30));
  expect(result.current.pastMessage).toBe(
    "L'hora de sortida ja ha passat. Tria'n una de més tard.",
  );
  expect(result.current.save?.disabled).toBe(true);
});

describe('el punt', () => {
  it('un punt retirat s’avisa i no es pot desar fins que se’n tria un altre', async () => {
    const retired = { ...plan, punt: { ...plan.punt, publicat: false } };
    const { result } = await renderVm(retired);
    expect(result.current.point.error).toBe("Aquest punt ja no està disponible; tria'n un altre.");
    expect(result.current.point.link).toBeNull();
    await act(async () => result.current.notes.onChange('Termo'));
    expect(result.current.save?.disabled).toBe(true);

    await act(async () => result.current.point.onPress!());
    expect(result.current.pointSheet?.visible).toBe(true);
    await waitFor(() => expect(result.current.pointSheet?.status).toBe('ok'));
    expect(get).toHaveBeenCalledWith('/punts');
    await act(async () => result.current.pointSheet!.search.onChange('prades'));
    expect(result.current.pointSheet!.options.map((option) => option.label)).toEqual([
      'Coll de Prades',
    ]);
    await act(async () => result.current.pointSheet!.options[0]!.onPress());
    expect(result.current.pointSheet?.visible).toBe(false);
    expect(result.current.point).toMatchObject({ name: 'Coll de Prades', error: null });

    await act(async () => result.current.save!.onPress());
    await waitFor(() => expect(back).toHaveBeenCalled());
    expect(patch).toHaveBeenCalledWith('/plans/plan-1', { puntId: 'prades', notes: 'Termo' });
  });

  it('el full de punts només demana /punts quan s’obre', async () => {
    const { result } = await renderVm();
    expect(get).not.toHaveBeenCalledWith('/punts');
    await act(async () => result.current.point.onPress!());
    await waitFor(() => expect(result.current.pointSheet?.options).toHaveLength(2));
    expect(result.current.pointSheet!.options.find((o) => o.selected)?.label).toBe(
      'Serra del Montsec',
    );
  });
});

describe('el calendari del mòbil', () => {
  beforeEach(() => {
    calendar.isSupported.mockReturnValue(true);
    calendar.eventExists.mockResolvedValue(true);
    calendar.updateEvent.mockResolvedValue(undefined);
    calendar.requestCalendars.mockResolvedValue({
      status: 'ready',
      calendars: [{ id: 'google', title: 'Personal', account: 'Google' }],
    });
    calendar.createEvent.mockResolvedValue('native-event-2');
  });

  it('amb un esdeveniment vinculat, l’actualitza després de desar', async () => {
    patch.mockImplementation(async (_path, body) => ({ ...linked, ...(body as Partial<Pla>) }));
    const { result } = await renderVm(linked);
    expect(result.current.calendar?.linkedHint).toBe(
      "Els canvis també s'aplicaran a l'esdeveniment del calendari del mòbil.",
    );
    await act(async () => result.current.timeSheet.onMinuteChange(45));
    await act(async () => result.current.save!.onPress());
    await waitFor(() => expect(back).toHaveBeenCalled());
    // Es busca amb el pla d'abans (el que hi ha al calendari) i s'hi escriu el nou.
    expect(calendar.eventExists).toHaveBeenCalledWith(linked);
    expect(calendar.updateEvent).toHaveBeenCalledWith(
      'native-event-1',
      expect.objectContaining({
        title: 'Talaia · Serra del Montsec',
        startDate: '2026-10-21T21:45:00.000Z',
        endDate: '2026-10-22T00:30:00.000Z',
        location: 'Serra del Montsec, Àger',
      }),
    );
    expect(put).not.toHaveBeenCalled();
  });

  it('si l’esdeveniment no és en aquest mòbil, avisa i ofereix afegir-lo (createEvent + PUT)', async () => {
    calendar.eventExists.mockResolvedValue(false);
    patch.mockImplementation(async (_path, body) => ({ ...linked, ...(body as Partial<Pla>) }));
    const { result } = await renderVm(linked);
    await act(async () => result.current.notes.onChange('Termo'));
    await act(async () => result.current.save!.onPress());
    await waitFor(() => expect(result.current.calendarNotice).not.toBeNull());
    expect(result.current.calendarNotice?.message).toContain("No hem trobat l'esdeveniment");
    expect(calendar.updateEvent).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();

    await act(async () => result.current.calendarNotice!.action!.onPress());
    await waitFor(() => expect(result.current.calendar?.target).not.toBeNull());
    expect(result.current.save).toMatchObject({
      label: 'Afegeix-lo al calendari',
      disabled: false,
    });
    await act(async () => result.current.save!.onPress());
    await waitFor(() => expect(back).toHaveBeenCalled());
    // Ja estava desat: cap altre PATCH, només l'esdeveniment nou i el vincle.
    expect(patch).toHaveBeenCalledTimes(1);
    expect(calendar.createEvent).toHaveBeenCalledWith(
      'google',
      expect.objectContaining({ notes: 'Termo' }),
    );
    expect(put).toHaveBeenCalledWith('/plans/plan-1/calendari', {
      calendariEventId: 'native-event-2',
    });
  });

  it('un error en actualitzar-lo deixa el pla desat, avisa i es pot reintentar', async () => {
    calendar.updateEvent.mockRejectedValueOnce(new Error('boom'));
    patch.mockImplementation(async (_path, body) => ({ ...linked, ...(body as Partial<Pla>) }));
    const { result } = await renderVm(linked);
    await act(async () => result.current.notes.onChange('Termo'));
    await act(async () => result.current.save!.onPress());
    await waitFor(() =>
      expect(result.current.calendarNotice?.message).toBe(
        "Pla desat, però no hem pogut actualitzar l'esdeveniment del calendari.",
      ),
    );
    expect(patch).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
    await act(async () => result.current.calendarNotice!.action!.onPress());
    await waitFor(() => expect(back).toHaveBeenCalled());
    expect(calendar.updateEvent).toHaveBeenCalledTimes(2);
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it('«Continua» surt amb el pla desat encara que el calendari hagi fallat', async () => {
    calendar.updateEvent.mockRejectedValue(new Error('boom'));
    patch.mockImplementation(async (_path, body) => ({ ...linked, ...(body as Partial<Pla>) }));
    const { result } = await renderVm(linked);
    await act(async () => result.current.notes.onChange('Termo'));
    await act(async () => result.current.save!.onPress());
    await waitFor(() => expect(result.current.calendarNotice).not.toBeNull());
    await act(async () => result.current.calendarNotice!.finish.onPress());
    await waitFor(() => expect(back).toHaveBeenCalled());
  });

  it('a Expo Go (sense calendari) desa el pla i no toca cap calendari', async () => {
    calendar.isSupported.mockReturnValue(false);
    const { result } = await renderVm(linked);
    expect(result.current.calendar?.linkedHint).toContain('no està disponible');
    await act(async () => result.current.notes.onChange('Termo'));
    await act(async () => result.current.save!.onPress());
    await waitFor(() => expect(back).toHaveBeenCalled());
    expect(calendar.eventExists).not.toHaveBeenCalled();
    expect(calendar.updateEvent).not.toHaveBeenCalled();
  });

  it('afegeix al calendari un pla que no hi era sense cap PATCH', async () => {
    const { result } = await renderVm(plan);
    await act(async () => result.current.calendar!.onChange(true));
    await waitFor(() => expect(result.current.calendar?.target).not.toBeNull());
    expect(result.current.save?.label).toBe('Afegeix-lo al calendari');
    await act(async () => result.current.save!.onPress());
    await waitFor(() => expect(back).toHaveBeenCalled());
    expect(patch).not.toHaveBeenCalled();
    expect(calendar.createEvent).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith('/plans/plan-1/calendari', {
      calendariEventId: 'native-event-2',
    });
  });
});

describe('usePlanLoader', () => {
  const renderLoader = async (client = createClient()) => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return renderHook(() => usePlanLoader('plan-1'), { wrapper });
  };

  it('carrega el pla amb GET /plans/{id}', async () => {
    const { result } = await renderLoader();
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.plan).toEqual(plan);
    expect(get).toHaveBeenCalledWith('/plans/plan-1', undefined, expect.anything());
  });

  it('des d’«Els meus plans», el pla surt de la llista sense esperar', async () => {
    let resolve: (value: Pla) => void = () => {};
    get.mockReturnValue(new Promise((done) => (resolve = done)));
    const client = createClient();
    client.setQueryData([...PLANS_KEY, 'futurs', 'ca'], [plan]);
    const { result } = await renderLoader(client);
    expect(result.current.state).toBe('ready');
    expect(result.current.plan).toEqual(plan);
    await act(async () => resolve(plan));
  });

  it('un 404 és «Aquest pla ja no existeix»; un altre error es pot reintentar', async () => {
    get.mockRejectedValue(new ApiError(404, 'plan_not_found', 'x'));
    const { result } = await renderLoader();
    await waitFor(() => expect(result.current.state).toBe('missing'));
    expect(result.current.missing.title).toBe('Aquest pla ja no existeix');

    get.mockRejectedValue(new ApiError(500, 'internal_error', 'x'));
    const { result: failed } = await renderLoader();
    await waitFor(() => expect(failed.current.state).toBe('error'));
    get.mockResolvedValue(plan);
    await act(async () => failed.current.error.action.onPress());
    await waitFor(() => expect(failed.current.state).toBe('ready'));
  });
});
