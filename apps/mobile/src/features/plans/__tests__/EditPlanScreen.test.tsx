import type { Pla, PuntsMapaGeoJson } from '@talaia/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError, apiGet, apiPatch } from '@/core/api/httpClient';
import i18n from '@/core/i18n';

import { EditPlanScreen } from '../EditPlanScreen';
import { plan } from '../__fixtures__/plan';

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

const METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

/** `/punts` es guarda una hora (`useMapPointsQuery`): sense buidar el client, Jest no surt. */
let client: QueryClient | undefined;

function renderScreen(loaded: Pla | Error = plan) {
  get.mockImplementation((async (path: string) => {
    if (path === '/punts') return POINTS;
    if (path.startsWith('/plans/')) {
      if (loaded instanceof Error) throw loaded;
      return loaded;
    }
    return { data: [] };
  }) as typeof apiGet);
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const current = client;
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <GestureHandlerRootView>
        <SafeAreaProvider initialMetrics={METRICS}>
          <QueryClientProvider client={current}>{children}</QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }
  return render(<EditPlanScreen planId="plan-1" />, { wrapper: Wrapper });
}

// Pantalla sencera: en paral·lel amb la resta, l'entorn de Skia endarrereix el primer render.
jest.setTimeout(15_000);

beforeEach(async () => {
  // Dimecres 21 d'octubre de 2026 a les 18:07; només el rellotge, no els temporitzadors.
  jest.useFakeTimers({
    now: new Date(2026, 9, 21, 18, 7),
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
  patch.mockReset();
  back.mockReset();
  push.mockReset();
  await i18n.changeLanguage('ca');
});

afterEach(() => {
  client?.clear();
  jest.useRealTimers();
});

it('carrega el pla i mostra «Edita el pla» amb «Desa els canvis»', async () => {
  await renderScreen();
  expect(await screen.findByRole('button', { name: 'Desa els canvis' })).toBeDisabled();
  expect(screen.getByRole('header', { name: 'Edita el pla' })).toBeOnTheScreen();
  expect(screen.getByDisplayValue('Portar el trípode')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Veure el punt' }));
  expect(push).toHaveBeenCalledWith({ pathname: '/punt/[id]', params: { id: 'montsec' } });
});

it('el full del punt cerca entre els punts publicats i canvia el punt del pla', async () => {
  patch.mockResolvedValue({ ...plan, punt: { ...plan.punt, id: 'prades', nom: 'Coll de Prades' } });
  await renderScreen();
  await fireEvent.press(
    await screen.findByRole('button', {
      name: "Punt d'observació: Serra del Montsec, Àger. Toca'l per canviar-lo",
    }),
  );
  expect(await screen.findByText('Tria el punt')).toBeOnTheScreen();
  await fireEvent.changeText(await screen.findByTestId('point-search'), 'prad');
  await waitFor(() =>
    expect(screen.queryByRole('radio', { name: /Serra del Montsec/ })).toBeNull(),
  );
  await fireEvent.press(screen.getByRole('radio', { name: 'Coll de Prades, Prades' }));
  expect(await screen.findByText('Coll de Prades')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Desa els canvis' }));
  await waitFor(() => expect(back).toHaveBeenCalled());
  expect(patch).toHaveBeenCalledWith('/plans/plan-1', { puntId: 'prades' });
});

it('un pla passat s’obre en mode lectura', async () => {
  await renderScreen({ ...plan, dataHoraInici: '2026-10-19T19:00:00.000Z', dataHoraFi: null });
  expect(await screen.findByRole('header', { name: 'Pla fet' })).toBeOnTheScreen();
  expect(
    screen.getByText("Aquest pla ja s'ha acabat: el pots consultar, però no modificar."),
  ).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Desa els canvis' })).toBeNull();
  expect(screen.queryByRole('switch')).toBeNull();
});

it('un pla que ja no existeix ho diu i permet tornar enrere', async () => {
  await renderScreen(new ApiError(404, 'plan_not_found', 'x'));
  expect(await screen.findByText('Aquest pla ja no existeix')).toBeOnTheScreen();
  await fireEvent.press(screen.getAllByRole('button', { name: 'Enrere' }).at(-1)!);
  expect(back).toHaveBeenCalled();
});
