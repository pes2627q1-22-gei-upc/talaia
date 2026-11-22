import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Linking, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { apiGet, ApiError } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { fonts } from '@/core/theme/tokens';
import { createQueryWrapper } from '@/test-utils/queryWrapper';
import { useCurrentPlaceQuery } from '@/features/explore/locationRepository';

import { PointDetailScreen } from '../PointDetailScreen';
import { directionsUrl } from '../pointModel';
import { asPointResponse, hour, point, respond } from '../__fixtures__/point';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
}));
jest.mock('@/features/explore/locationRepository', () => ({ useCurrentPlaceQuery: jest.fn() }));
// El WebView no existeix a Jest; es comprova la pantalla nativa amb el repository real.
jest.mock('../PointLocationMap', () => () => null);
jest.mock('../FavoriteButton', () => ({ FavoriteButton: () => null }));
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
}));
const get = jest.mocked(apiGet);
const locationQuery = jest.mocked(useCurrentPlaceQuery);
const readyPlace = {
  status: 'ready' as const,
  place: { name: 'Barcelona', lat: 41.385, lon: 2.17 },
};
const deniedPlace = { status: 'denied' as const, canAskAgain: false };

function mockPlace(data: typeof readyPlace | typeof deniedPlace) {
  const refetch = jest.fn().mockResolvedValue({ data });
  locationQuery.mockReturnValue({ data, refetch } as unknown as ReturnType<
    typeof useCurrentPlaceQuery
  >);
  return refetch;
}

async function renderScreen() {
  const QueryWrapper = createQueryWrapper();
  return render(
    <QueryWrapper>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 393, height: 852 },
            insets: { top: 0, left: 0, right: 0, bottom: 34 },
          }}
        >
          <PointDetailScreen pointId="montsec" />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryWrapper>,
  );
}
afterEach(() => jest.restoreAllMocks());
beforeEach(async () => {
  get.mockReset();
  mockPlace(deniedPlace);
  // Per defecte, com l'API: la fitxa o el desglossament segons la ruta.
  get.mockImplementation(respond());
  await i18n.changeLanguage('ca');
});

it('obre les opcions de Mobilicat des de Com arribar i després el mapa del mòbil', async () => {
  const refetchPlace = mockPlace(readyPlace);
  const pointResponse = respond();
  get.mockImplementation((path) =>
    path.endsWith('/rutes')
      ? Promise.resolve({
          estat: 'disponible',
          destacada: {
            sortida: '2026-11-18T10:00:00Z',
            arribada: '2026-11-18T10:27:00Z',
            distanciaMetres: 12340,
            duradaSegons: 1561,
            transbordaments: 1,
            trams: [
              { sequence: 0, mode: 'WALK' },
              {
                sequence: 1,
                mode: 'PUBLIC_TRANSPORT',
                transitMode: 'RAIL',
                lineShortName: 'R1',
                agencyName: 'Rodalies',
              },
            ],
          },
          alternatives: [
            {
              sortida: '2026-11-18T10:00:00Z',
              arribada: '2026-11-18T10:27:00Z',
              distanciaMetres: 12340,
              duradaSegons: 1561,
              transbordaments: 1,
              trams: [
                { sequence: 0, mode: 'WALK' },
                {
                  sequence: 1,
                  mode: 'PUBLIC_TRANSPORT',
                  transitMode: 'RAIL',
                  lineShortName: 'R1',
                  agencyName: 'Rodalies',
                },
              ],
            },
            {
              sortida: '2026-11-18T22:40:00Z',
              arribada: '2026-11-18T23:20:00Z',
              distanciaMetres: 10000,
              duradaSegons: 2400,
              transbordaments: 0,
              trams: [{ sequence: 0, mode: 'CAR' }],
            },
          ],
        })
      : pointResponse(path),
  );
  await renderScreen();
  expect(await screen.findByRole('header', { name: point.nom })).toBeOnTheScreen();
  expect(locationQuery).toHaveBeenCalledWith(false);
  expect(refetchPlace).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Com arribar' })).toBeOnTheScreen();
  expect(get).not.toHaveBeenCalledWith(
    '/punts/montsec/rutes',
    expect.anything(),
    expect.anything(),
  );
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Com arribar' })));
  await waitFor(() => expect(refetchPlace).toHaveBeenCalledTimes(1));
  expect(await screen.findByText('A peu → R1')).toBeOnTheScreen();
  expect(screen.getByText('Transport públic')).toBeOnTheScreen();
  expect(screen.getByText('Destacada')).toBeOnTheScreen();
  expect(screen.getByText("Ordenat per hora d'arribada.")).toBeOnTheScreen();
  expect(screen.getByText('Dades de Mobilicat')).toBeOnTheScreen();
  expect(screen.getByText('27 min')).toBeOnTheScreen();
  expect(screen.getByText('12,3 km', { exact: false })).toBeOnTheScreen();
  expect(screen.getByText('Surt a les 11:00')).toBeOnTheScreen();
  expect(StyleSheet.flatten(screen.getByText('11:27').props.style).fontFamily).toBe(fonts.bold);
  expect(screen.getByText('1 transbordament', { exact: false })).toBeOnTheScreen();
  expect(screen.getByText('+1 dia', { exact: false })).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: /Transport públic, 27 min/ }));
  expect(await screen.findByText('Tren')).toBeOnTheScreen();
  expect(screen.getByText('Rodalies')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: "Canvia l'hora de sortida: Ara" }));
  expect(await screen.findByRole('adjustable', { name: 'Hora de sortida' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Obre-ho a Maps' })).toBeNull();
  expect(screen.queryByText('A peu → R1')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Mostra les rutes' }));
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith(
      '/punts/montsec/rutes',
      { lat: 41.385, lon: 2.17, sortida: expect.any(String) },
      { signal: expect.any(AbortSignal) },
    ),
  );
  await waitFor(() => expect(screen.getByText('A peu → R1')).toBeOnTheScreen());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Com arribar' })).toBeEnabled());
  expect(open).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Torna al punt' }));
  await waitFor(() =>
    expect(screen.queryByRole('header', { name: 'Opcions per arribar-hi' })).toBeNull(),
  );
  expect(screen.getByRole('header', { name: point.nom })).toBeOnTheScreen();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Com arribar' })));
  expect(await screen.findByRole('header', { name: 'Opcions per arribar-hi' })).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Obre-ho a Maps' }));
  expect(open).toHaveBeenCalledWith(directionsUrl(point.lat, point.lon, Platform.OS));
  open.mockRestore();
});

it('manté la fitxa i el botó quan Mobilicat no respon', async () => {
  mockPlace(readyPlace);
  const pointResponse = respond();
  get.mockImplementation((path) =>
    path.endsWith('/rutes')
      ? Promise.reject(new Error('Mobilicat no disponible'))
      : pointResponse(path),
  );
  await renderScreen();
  expect(await screen.findByRole('header', { name: point.nom })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Com arribar' })).toBeOnTheScreen();
  expect(get).not.toHaveBeenCalledWith(
    '/punts/montsec/rutes',
    expect.anything(),
    expect.anything(),
  );
  expect(screen.queryByText(/km · .* min/)).toBeNull();
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Com arribar' })));
  await waitFor(() =>
    expect(open).toHaveBeenCalledWith(directionsUrl(point.lat, point.lon, Platform.OS)),
  );
  expect(screen.queryByText('Opcions per arribar-hi')).toBeNull();
  open.mockRestore();
});

it('obre Maps directament quan Mobilicat retorna no disponible', async () => {
  mockPlace(readyPlace);
  const pointResponse = respond();
  get.mockImplementation((path) =>
    path.endsWith('/rutes')
      ? Promise.resolve({ estat: 'no_disponible', destacada: null, alternatives: [] })
      : pointResponse(path),
  );
  await renderScreen();
  expect(await screen.findByRole('header', { name: point.nom })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Com arribar' })).toBeOnTheScreen();
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Com arribar' })));
  await waitFor(() =>
    expect(open).toHaveBeenCalledWith(directionsUrl(point.lat, point.lon, Platform.OS)),
  );
  open.mockRestore();
});

it('obre Maps sense consultar Mobilicat si no hi ha permís d’ubicació', async () => {
  await renderScreen();
  expect(await screen.findByRole('header', { name: point.nom })).toBeOnTheScreen();
  expect(get).not.toHaveBeenCalledWith(
    '/punts/montsec/rutes',
    expect.anything(),
    expect.anything(),
  );
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Com arribar' })));
  await waitFor(() =>
    expect(open).toHaveBeenCalledWith(directionsUrl(point.lat, point.lon, Platform.OS)),
  );
  open.mockRestore();
});

it('mostra les dades i les hores amb etiquetes accessibles', async () => {
  get.mockImplementation(respond());
  await renderScreen();
  expect(await screen.findByRole('header', { name: point.nom })).toBeOnTheScreen();
  expect(screen.getByText(point.descripcio)).toBeOnTheScreen();
  expect(screen.getByText(point.accessibilitat!)).toBeOnTheScreen();
  expect(screen.getByText('Vistes obertes')).toBeOnTheScreen();
  expect(screen.getByText('Cap al sud i al sud-oest')).toBeOnTheScreen();
  expect(screen.getByText('21,4 mag/arcsec² · Foscor de referència del lloc')).toBeOnTheScreen();
  expect(screen.getByText('Cel molt fosc · qualitat excel·lent')).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Informació del punt' })).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Aquesta nit' })).toBeOnTheScreen();
  expect(screen.getByLabelText(/23:00.*87 de 100/)).toBeOnTheScreen();
  // Els factors de la millor hora de la nit; el Sol, ple, no surt.
  expect(screen.getByLabelText('Núvols. Cel ras')).toHaveAccessibilityValue({ now: 95 });
  expect(screen.getByLabelText('Lluna. La Lluna aclareix el cel')).toHaveAccessibilityValue({
    now: 68,
  });
  expect(screen.queryByText('Sol')).toBeNull();
});

it("explica l'índex, a quina hora correspon i que les hores es poden tocar (TG-264)", async () => {
  // 22:30 a Catalunya: l'índex actual (22:00) és el de l'hora en curs.
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-18T20:30:00Z'));
  await renderScreen();
  expect(await screen.findByText("Índex d'ara · 22:00")).toBeOnTheScreen();
  expect(
    screen.getByText("Millor moment d'aquesta nit: de 01:00 a 02:00, amb un màxim de 94."),
  ).toBeOnTheScreen();
  expect(screen.getByText(/^L'índex va de 0 a 100: com més alt, millor/)).toBeOnTheScreen();
  expect(screen.getByText("Toca una hora per veure'n el desglossament.")).toBeOnTheScreen();
  expect(screen.getByLabelText(/01:00.*94 de 100/)).toHaveProp(
    'accessibilityHint',
    "Mostra el desglossament de l'índex d'aquesta hora",
  );
  expect(screen.getByText("Per què a la 01:00 l'índex és 94")).toBeOnTheScreen();
});

it('la millor franja de diverses hores en diu el màxim, no un valor per a totes', async () => {
  get.mockImplementation(
    respond(point, [
      { ...hour, hora: '2026-10-18T21:00:00Z', valor: 87 },
      { ...hour, hora: '2026-10-18T22:00:00Z', valor: 90 },
      { ...hour, hora: '2026-10-18T23:00:00Z', valor: 94 },
    ]),
  );
  await renderScreen();
  expect(
    await screen.findByText("Millor moment d'aquesta nit: de 23:00 a 02:00, amb un màxim de 94."),
  ).toBeOnTheScreen();
  expect(screen.getAllByLabelText(/Dins del millor moment/)).toHaveLength(3);
});

it('triar una hora en mostra els factors, també una hora atenuada', async () => {
  get.mockImplementation(
    respond(point, [
      hour,
      {
        ...hour,
        hora: '2026-10-18T22:00:00Z',
        valor: 35,
        franja: 'tap',
        factors: { nuvols: 0.3, sol: 1, foscor: 0.94, lluna: 1 },
      },
      { ...hour, hora: '2026-10-18T23:00:00Z', valor: 94 },
    ]),
  );
  await renderScreen();
  const best = await screen.findByLabelText(/01:00.*94 de 100/);
  // Per defecte, la millor hora, amb el valor dins la barra.
  expect(best.props.accessibilityState).toEqual({ selected: true });
  expect(screen.getByLabelText('Núvols. Cel ras')).toHaveAccessibilityValue({ now: 95 });
  expect(screen.getByText("Per què a la 01:00 l'índex és 94")).toBeOnTheScreen();

  const muted = screen.getByLabelText(/00:00.*35 de 100/);
  await fireEvent.press(muted);
  expect(muted.props.accessibilityState).toEqual({ selected: true });
  expect(best.props.accessibilityState).toEqual({ selected: false });
  expect(screen.getByText("Per què a les 00:00 l'índex és 35")).toBeOnTheScreen();
  expect(screen.getAllByText('35')).toHaveLength(1);
  expect(screen.getByLabelText('Núvols. Molt ennuvolat')).toHaveAccessibilityValue({ now: 30 });
  expect(screen.getByLabelText('Lluna. La Lluna no molesta')).toHaveAccessibilityValue({
    now: 100,
  });
});

it('una hora de la v2 ensenya la fila d’humitat amb la cita de l’SMC; una de la v1, no (TG-184)', async () => {
  get.mockImplementation(
    respond(point, [
      { ...hour, valor: 60 },
      {
        ...hour,
        hora: '2026-10-18T23:00:00Z',
        valor: 81,
        versio: 2,
        humitatCorregida: true,
        factors: { ...hour.factors, humitat: 0.86 },
      },
    ]),
  );
  await renderScreen();
  // La millor hora és la de la v2: la humitat hi surt amb la pista i, a sota, la cita.
  expect(await screen.findByText("Per què a la 01:00 l'índex és 81")).toBeOnTheScreen();
  expect(screen.getByText('Humitat')).toBeOnTheScreen();
  expect(screen.getByText('La humitat enterboleix el cel')).toBeOnTheScreen();
  expect(
    screen.getByText(
      'Corregida amb les observacions de la XEMA (Servei Meteorològic de Catalunya)',
    ),
  ).toBeOnTheScreen();
  expect(
    screen.getByLabelText(
      'Humitat. La humitat enterboleix el cel. Corregida amb les observacions de la XEMA (Servei Meteorològic de Catalunya)',
    ),
  ).toHaveAccessibilityValue({ now: 86 });

  await fireEvent.press(screen.getByLabelText(/23:00.*60 de 100/));
  expect(screen.getByText("Per què a les 23:00 l'índex és 60")).toBeOnTheScreen();
  expect(screen.queryByText('Humitat')).toBeNull();
});

it('manté totes les barres visibles quan no hi ha cap millor franja', async () => {
  get.mockImplementation(
    respond(
      point,
      point.properesHores.map((entry) => ({ ...entry, franja: 'tap' })),
    ),
  );
  await renderScreen();
  const bar = await screen.findByTestId('hour-bar-2026-10-18T21:00:00Z');
  expect(StyleSheet.flatten(bar.props.style).opacity).toBeUndefined();
});

it('el botó de reintent recupera la fitxa després d’un error', async () => {
  get.mockRejectedValueOnce(new Error('offline'));
  await renderScreen();
  const retry = await screen.findByRole('button', { name: 'Torna-ho a provar' });
  get.mockResolvedValue(asPointResponse());
  await fireEvent.press(retry);
  expect(await screen.findByRole('header', { name: point.nom })).toBeOnTheScreen();
});

it('explica el 404 sense oferir un reintent inútil', async () => {
  get.mockRejectedValue(new ApiError(404, 'not_found', 'Not found'));
  await renderScreen();
  expect(await screen.findByText('No hem trobat aquest punt')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Torna-ho a provar' })).toBeNull();
});
