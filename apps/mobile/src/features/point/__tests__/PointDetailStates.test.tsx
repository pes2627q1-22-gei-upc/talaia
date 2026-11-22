import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Linking, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/core/i18n';
import { useCurrentPlaceQuery } from '@/features/explore/locationRepository';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { asBreakdown, hour, point } from '../__fixtures__/point';
import { PointDetailScreen } from '../PointDetailScreen';
import { directionsUrl } from '../pointModel';
import {
  usePointBreakdownQuery,
  usePointDetailQuery,
  usePointRoutesQuery,
} from '../pointRepository';

jest.mock('../pointRepository', () => ({
  usePointDetailQuery: jest.fn(),
  usePointBreakdownQuery: jest.fn(),
  usePointRoutesQuery: jest.fn(),
}));
jest.mock('@/features/explore/locationRepository', () => ({ useCurrentPlaceQuery: jest.fn() }));
jest.mock('../PointLocationMap', () => () => null);
jest.mock('../FavoriteButton', () => ({ FavoriteButton: () => null }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
  useRouter: () => ({ push: mockPush }),
}));

const detail = jest.mocked(usePointDetailQuery);
const breakdown = jest.mocked(usePointBreakdownQuery);
const refetchDetail = jest.fn();
const refetchHours = jest.fn();
const QueryWrapper = createQueryWrapper();

function setDetail(overrides: Partial<ReturnType<typeof usePointDetailQuery>> = {}) {
  detail.mockReturnValue({
    data: point,
    error: null,
    isFetching: false,
    isError: false,
    refetch: refetchDetail,
    ...overrides,
  } as ReturnType<typeof usePointDetailQuery>);
}

function setHours(overrides: Partial<ReturnType<typeof usePointBreakdownQuery>> = {}) {
  breakdown.mockReturnValue({
    data: asBreakdown(),
    isPending: false,
    isError: false,
    refetch: refetchHours,
    ...overrides,
  } as ReturnType<typeof usePointBreakdownQuery>);
}

function page() {
  return (
    <QueryWrapper>
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 393, height: 852 },
          insets: { top: 59, left: 0, right: 0, bottom: 34 },
        }}
      >
        <PointDetailScreen pointId="montsec" />
      </SafeAreaProvider>
    </QueryWrapper>
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('ca');
  setDetail();
  setHours();
  jest.mocked(useCurrentPlaceQuery).mockReturnValue({
    data: { status: 'denied', canAskAgain: false },
    refetch: jest.fn().mockResolvedValue({ data: { status: 'denied', canAskAgain: false } }),
  } as unknown as ReturnType<typeof useCurrentPlaceQuery>);
  jest.mocked(usePointRoutesQuery).mockReturnValue({
    data: undefined,
  } as ReturnType<typeof usePointRoutesQuery>);
});
afterEach(() => jest.restoreAllMocks());

it('espera la fitxa sense oferir accions ni errors i mostra el contingut quan arriba', async () => {
  setDetail({ data: undefined, isFetching: true });
  const view = await render(page());
  expect(screen.queryByRole('button', { name: 'Com arribar' })).toBeNull();
  expect(screen.queryByText('No hem pogut carregar la fitxa')).toBeNull();
  setDetail();
  await view.rerender(page());
  expect(screen.getByRole('header', { name: point.nom })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Com arribar' })).toBeEnabled();
});

it('obre Maps amb les coordenades del punt des de Com arribar', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue();
  await render(page());
  await fireEvent.press(screen.getByRole('button', { name: 'Com arribar' }));
  await waitFor(() =>
    expect(open).toHaveBeenCalledWith(directionsUrl(point.lat, point.lon, Platform.OS)),
  );
});

it('informa si Maps no es pot obrir', async () => {
  jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('Maps unavailable'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(page());
  await fireEvent.press(screen.getByRole('button', { name: 'Com arribar' }));
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith(
      'No hem pogut obrir el mapa',
      "Torna-ho a provar d'aquí a un moment.",
    ),
  );
});

it('Crea un pla obre el pla amb la millor franja de la nit, inici i final (TG-157)', async () => {
  mockPush.mockReset();
  await render(page());
  await fireEvent.press(screen.getByRole('button', { name: 'Crea un pla' }));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/pla/nou',
    // Una sola hora bona: la franja dura una hora.
    params: { puntId: 'montsec', inici: '2026-10-18T23:00:00Z', fi: '2026-10-19T00:00:00.000Z' },
  });
});

it('sense cap bona franja, Crea un pla només porta el punt', async () => {
  mockPush.mockReset();
  setHours({ data: asBreakdown(point, [{ ...hour, valor: 20, franja: 'tap' }]) });
  await render(page());
  await fireEvent.press(screen.getByRole('button', { name: 'Crea un pla' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/pla/nou', params: { puntId: 'montsec' } });
});

it('de dia explica per què no hi ha índex nocturn a la targeta', async () => {
  setDetail({
    data: { ...point, indexActual: { ...hour, valor: 0, factors: { ...hour.factors, sol: 0 } } },
  });
  await render(page());
  expect(screen.getByText('És de dia')).toBeOnTheScreen();
  expect(screen.getByText("L'índex compta a partir del vespre.")).toBeOnTheScreen();
});

it('explica que no hi ha índex ni hores i omet les metadades absents', async () => {
  setDetail({
    data: {
      ...point,
      indexActual: null,
      properesHores: [],
      descripcio: '',
      accessibilitat: null,
      horitzoObert: [],
      sqm: null,
    },
  });
  setHours({ data: asBreakdown(point, []) });
  await render(page());
  expect(screen.getByText('Índex encara no disponible')).toBeOnTheScreen();
  expect(screen.getByText('Encara no hi ha previsió per a aquesta nit.')).toBeOnTheScreen();
  expect(screen.queryByRole('header', { name: 'Informació del punt' })).toBeNull();
  expect(screen.queryByText(/Per què a les/)).toBeNull();
});

it('manté la fitxa mentre espera només les hores i les presenta quan arriben', async () => {
  setHours({ data: undefined, isPending: true });
  const view = await render(page());
  expect(screen.getByRole('header', { name: point.nom })).toBeOnTheScreen();
  expect(screen.queryByText('Encara no hi ha previsió per a aquesta nit.')).toBeNull();
  expect(screen.queryByText(/Per què a les/)).toBeNull();
  setHours();
  await view.rerender(page());
  expect(screen.getByText("Per què a la 01:00 l'índex és 94")).toBeOnTheScreen();
});

it('permet reintentar les hores des del desglossament sense perdre la fitxa', async () => {
  setHours({ data: undefined, isError: true });
  const view = await render(page());
  expect(screen.getByRole('header', { name: point.nom })).toBeOnTheScreen();
  expect(screen.getByText("No hem pogut carregar la previsió d'aquesta nit.")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Torna-ho a provar' }));
  expect(refetchHours).toHaveBeenCalledTimes(1);
  expect(refetchDetail).toHaveBeenCalledTimes(1);
  setHours();
  await view.rerender(page());
  expect(screen.getByText("Per què a la 01:00 l'índex és 94")).toBeOnTheScreen();
});

it('conserva la informació després d’un error de refresc i bloqueja el reintent pendent', async () => {
  setDetail({ isError: true });
  const view = await render(page());
  expect(screen.getByRole('header', { name: point.nom })).toBeOnTheScreen();
  expect(
    screen.getByText(
      "No s'han pogut actualitzar les dades. Es mostra l'última informació disponible.",
    ),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Torna-ho a provar' }));
  expect(refetchDetail).toHaveBeenCalledTimes(1);
  setDetail({ isError: true, isFetching: true });
  await view.rerender(page());
  const retry = screen.getByRole('button', { name: 'Torna-ho a provar' });
  expect(retry).toBeDisabled();
  await fireEvent.press(retry);
  expect(refetchDetail).toHaveBeenCalledTimes(1);
});

it('torna a la millor hora si la seleccionada desapareix en actualitzar les dades', async () => {
  const view = await render(page());
  await fireEvent.press(screen.getByLabelText(/00:00.*35 de 100/));
  expect(screen.getByText("Per què a les 00:00 l'índex és 35")).toBeOnTheScreen();
  setHours({ data: asBreakdown(point, [hour]) });
  await view.rerender(page());
  expect(screen.getByLabelText(/23:00.*87 de 100/)).toBeSelected();
  expect(screen.getByText("Per què a les 23:00 l'índex és 87")).toBeOnTheScreen();
  expect(screen.queryByText("Per què a les 00:00 l'índex és 35")).toBeNull();
});
