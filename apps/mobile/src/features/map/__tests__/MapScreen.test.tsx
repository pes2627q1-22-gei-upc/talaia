import type { Recomanacio, RecomanacionsResposta } from '@talaia/shared';
import { router } from 'expo-router';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { Platform, StyleSheet, View } from 'react-native';

import i18n from '@/core/i18n';
import { ApiError } from '@/core/api/httpClient';

import { nightOf } from '../../explore/exploreModel';
import type { RecommendationParams } from '../../recommendations/recommendationsModel';

import { MapScreen } from '../MapScreen';
import type { MapPoints } from '../pointMarkers';
import { nightStyle } from '../style/nightStyle';
import { camera } from '../useMapViewModel';

let mockParams: RecommendationParams = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
}));

const mockRefetchRecommendations = jest.fn();
let mockRecommendations = {
  error: null as Error | null,
  data: undefined as RecomanacionsResposta | undefined,
  isPending: true,
  isError: false,
  isFetching: true,
  refetch: mockRefetchRecommendations,
};
jest.mock('../../recommendations/recommendationsRepository', () => ({
  useRecommendationsQuery: () => mockRecommendations,
}));

jest.mock('../useDeviceHeading', () => ({
  useDeviceHeading: () => ({ heading: null, active: true }),
}));

// Sense permís d'ubicació: «A prop meu» demana triar l'origen al mapa.
const mockDenied = { status: 'denied' as const, canAskAgain: false };
const mockRefetchLocation = jest.fn(async () => ({ data: mockDenied, isError: false }));
jest.mock('../../explore/locationRepository', () => ({
  useCurrentPlaceQuery: () => ({ data: mockDenied, isError: false, refetch: mockRefetchLocation }),
}));

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

const mockRefetch = jest.fn();
let mockQuery = {
  data: undefined as MapPoints | undefined,
  isPending: true,
  isError: false,
  isFetching: true,
  refetch: mockRefetch,
};
jest.mock('../mapRepository', () => ({ useMapPointsQuery: () => mockQuery }));

// La DOM component corre en un WebView: aquí només es comprova què li passa la pantalla.
const mockNightMap = jest.fn((_props: unknown) => <View testID="night-map" />);
jest.mock('../NightMap', () => ({
  __esModule: true,
  default: (props: unknown) => mockNightMap(props),
}));

describe('MapScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ca');
    mockNightMap.mockClear();
    mockRefetch.mockClear();
    mockRefetchRecommendations.mockClear();
    jest.mocked(router.push).mockClear();
    jest.mocked(router.back).mockClear();
    mockParams = {};
    mockRecommendations = {
      error: null,
      data: undefined,
      isPending: true,
      isError: false,
      isFetching: true,
      refetch: mockRefetchRecommendations,
    };
    mockQuery = {
      data: undefined,
      isPending: true,
      isError: false,
      isFetching: true,
      refetch: mockRefetch,
    };
  });

  it.each(['ca', 'es', 'en'])(
    'una franja passada explica el problema sense reintent (%s)',
    async (language) => {
      await i18n.changeLanguage(language);
      mockParams = { esdevenimentId: 'leonids-2026', lat: '41.98', lon: '2.82' };
      mockRecommendations = {
        ...mockRecommendations,
        isPending: false,
        isError: true,
        isFetching: false,
        error: new ApiError(400, 'franja_passada', 'Franja passada'),
      };
      await render(<MapScreen />, { wrapper: GestureHandlerRootView });
      expect(screen.getByText(i18n.t('recommendations.pastWindow'))).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: i18n.t('map.retry') })).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: i18n.t('map.back') }));
      expect(router.back).toHaveBeenCalledTimes(1);
    },
  );

  it("passa l'estil nocturn, la càmera i l'etiqueta accessible al mapa", async () => {
    await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    expect(screen.getByTestId('night-map')).toBeOnTheScreen();
    expect(mockNightMap).toHaveBeenCalledWith(
      expect.objectContaining({
        mapStyle: nightStyle,
        camera,
        accessibilityLabel: 'Mapa nocturn de Catalunya amb el relleu',
        points: { type: 'FeatureCollection', features: [] },
      }),
    );
  });

  it('obre la fitxa amb l’ID del marcador seleccionat', async () => {
    await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    const props = mockNightMap.mock.calls.at(-1)![0] as {
      onPointPress: (id: string) => Promise<void>;
    };
    await props.onPointPress('punt-real');
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/punt/[id]',
      params: { id: 'punt-real' },
    });
  });

  it('mostra que està carregant els punts', async () => {
    await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    expect(screen.getByText("S'estan carregant els llocs d'observació…")).toBeOnTheScreen();
  });

  it('mostra l’estat buit sense controls de prova', async () => {
    mockQuery = {
      ...mockQuery,
      data: { type: 'FeatureCollection', features: [] },
      isPending: false,
      isFetching: false,
    };
    await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    expect(screen.getByText('Encara no hi ha llocs disponibles')).toBeOnTheScreen();
    expect(screen.getByText('Torna-ho a provar més endavant.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Torna-ho a provar' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('retira l’avís quan arriben punts i els conserva si falla una actualització', async () => {
    const points: MapPoints = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [1, 41] },
          properties: { id: 'test', nom: 'Lloc de test', municipi: '', index: null },
        },
      ],
    };
    mockQuery = { ...mockQuery, data: points, isPending: false, isFetching: false };
    const { rerender } = await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    expect(screen.queryByText('Encara no hi ha llocs disponibles')).toBeNull();
    expect(screen.queryByText("S'estan carregant els llocs d'observació…")).toBeNull();
    mockQuery = { ...mockQuery, isError: true };
    await rerender(<MapScreen />);
    expect(screen.getByText('No hem pogut carregar els llocs')).toBeOnTheScreen();
    expect(mockNightMap).toHaveBeenLastCalledWith(expect.objectContaining({ points }));
    mockQuery = { ...mockQuery, isFetching: true };
    await rerender(<MapScreen />);
    expect(screen.getByText("S'estan carregant els llocs d'observació…")).toBeOnTheScreen();
    expect(
      screen.getByTestId('map-loading-indicator', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Torna-ho a provar' })).toBeNull();
  });

  it('permet tornar a provar sense amagar el mapa quan falla l’API', async () => {
    mockQuery = { ...mockQuery, isPending: false, isError: true, isFetching: false };
    await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    expect(screen.getByTestId('night-map')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Torna-ho a provar' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('el botó enrere torna a «Què vols veure?»', async () => {
    await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    await fireEvent.press(screen.getByRole('button', { name: 'Enrere' }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('mostra l’avís diürn amb els punts disponibles sense proposar un reintent', async () => {
    mockQuery = {
      ...mockQuery,
      isPending: false,
      isFetching: false,
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0.75, 42.05] },
            properties: {
              id: 'montsec',
              nom: 'Montsec',
              municipi: 'Àger',
              index: { valor: 0, franja: 'tap', deDia: true },
            },
          },
        ],
      },
    };
    await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    expect(screen.getByText('És de dia')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Torna-ho a provar' })).toBeNull();
    expect(screen.getByTestId('night-map')).toBeOnTheScreen();
  });

  it('«A prop meu» sense ubicació demana tocar el mapa, i el toc obre el rànquing', async () => {
    await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    const nearby = screen.getByRole('button', { name: 'A prop meu' });
    expect(nearby).toHaveProp('accessibilityHint', 'Mostra els millors punts a prop teu');
    expect(mockNightMap).toHaveBeenLastCalledWith(
      expect.objectContaining({ onMapPress: undefined, origin: null }),
    );
    await fireEvent.press(nearby);
    expect(
      screen.getByRole('header', { name: "Toca el mapa per triar d'on surts" }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'A prop meu' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Obre la configuració' })).toBeOnTheScreen();
    const props = mockNightMap.mock.calls.at(-1)![0] as {
      onMapPress: (lat: number, lon: number) => Promise<void>;
    };
    await act(() => props.onMapPress(41.5, 1.9));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/recomanacions',
      params: { aprop: 'triat', lat: '41.5', lon: '1.9' },
    });
  });

  it('es pot tancar sense triar res', async () => {
    await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    await fireEvent.press(screen.getByRole('button', { name: 'A prop meu' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tanca' }));
    expect(screen.queryByText("Toca el mapa per triar d'on surts")).toBeNull();
    expect(screen.getByRole('button', { name: 'A prop meu' })).toBeOnTheScreen();
  });
});

describe('MapScreen amb «A prop meu» (HU02)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ca');
    mockNightMap.mockClear();
    mockRecommendations = {
      error: null,
      data: undefined,
      isPending: true,
      isError: false,
      isFetching: true,
      refetch: mockRefetchRecommendations,
    };
  });

  it('des d’un lloc triat: la capçalera ho diu i el mapa en marca el punt de sortida', async () => {
    mockParams = { aprop: 'triat', lat: '41.5', lon: '1.9' };
    await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    expect(screen.getByRole('header', { name: /A prop meu/ })).toBeOnTheScreen();
    expect(screen.getByText('Des del punt triat')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'A prop meu' })).toBeNull();
    expect(screen.getByTestId('ranking-safe-area')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Plega la llista' }));
    expect(screen.getByRole('button', { name: 'Desplega la llista' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Desplega la llista' }));
    expect(screen.getByLabelText('Buscant els millors punts…')).toBeOnTheScreen();
    expect(mockNightMap).toHaveBeenLastCalledWith(
      expect.objectContaining({
        origin: expect.objectContaining({ lat: 41.5, lon: 1.9, label: 'Punt de sortida' }),
        cluster: false,
      }),
    );
  });
});

describe('MapScreen amb una cerca (TG-102, mockup 03)', () => {
  /** Hora local fixa, sigui quina sigui la zona del sistema on corren els tests. */
  // Hora de Catalunya (+02:00 a l'octubre), sigui quina sigui la zona del qui passa els tests.
  const at = (hour: number) =>
    new Date(`2026-10-22T${String(hour).padStart(2, '0')}:00:00+02:00`).toISOString();
  const punt = (
    id: string,
    nom: string,
    valor: number | null,
    tempsEstimat: number,
  ): Recomanacio => ({
    id,
    nom,
    municipi: '',
    lat: 42,
    lon: 1,
    distanciaKm: 80,
    tempsEstimat,
    millorHora:
      valor === null
        ? null
        : {
            hora: at(2),
            valor,
            franja: valor >= 70 ? 'ras' : 'jus',
            factors: { nuvols: 1, sol: 1, foscor: 1, lluna: 1 },
            foscorEstimada: false,
          },
    mitjana: valor,
    horesAmbIndex: valor === null ? 0 : 8,
  });
  const resposta = (punts: Recomanacio[]): RecomanacionsResposta => ({
    data: '2026-10-21',
    tempsMaxim: 150,
    radiKm: 150,
    franja: { desDe: at(22), finsA: at(6) },
    total: punts.length,
    punts,
  });

  beforeEach(async () => {
    await i18n.changeLanguage('ca');
    jest.mocked(router.push).mockClear();
    mockRefetchRecommendations.mockClear();
    mockRecommendations = {
      error: null,
      data: undefined,
      isPending: true,
      isError: false,
      isFetching: true,
      refetch: mockRefetchRecommendations,
    };
    mockParams = {
      objectiu: 'pluja_estels',
      lat: '41.98',
      lon: '2.82',
      data: nightOf(new Date()),
      desDe: '22',
      finsA: '6',
      tempsMaxim: '150',
      lloc: 'Girona',
    };
  });

  it('ensenya la cerca, la llegenda, els tres millors punts i els seus marcadors', async () => {
    mockRecommendations = {
      ...mockRecommendations,
      isPending: false,
      isFetching: false,
      data: resposta([
        punt('montsec', 'Serra del Montsec', 87, 135),
        punt('prades', 'Muntanyes de Prades', 81, 100),
        punt('montsant', 'Serra de Montsant', 78, 115),
        punt('cadi', 'Serra del Cadí', null, 150),
      ]),
    };
    await render(<MapScreen />, { wrapper: GestureHandlerRootView });

    expect(screen.getByRole('header', { name: /Pluja d'estels, aquesta nit/ })).toBeOnTheScreen();
    expect(screen.getByText('Des de Girona, fins a 2 h 30 min')).toBeOnTheScreen();
    expect(screen.getByText('Justet')).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Millors punts per a aquesta nit' }),
    ).toBeOnTheScreen();
    // Sense cerca no hi ha l'avís del catàleg, encara que `/punts` no hagi carregat.
    expect(screen.queryByText("S'estan carregant els llocs d'observació…")).toBeNull();

    const montsec = screen.getByRole('button', { name: /^1r: Serra del Montsec/ });
    expect(montsec).toHaveAccessibleName(
      '1r: Serra del Montsec. Índex de visibilitat: 87 de 100, Cel ras. Millor hora: 02:00. 2 h 15 min en cotxe',
    );
    expect(screen.queryByText('Serra del Cadí')).toBeNull();

    // Amb un rànquing, sense grups i amb la càmera als punts i a l'origen (Girona).
    expect(mockNightMap).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cluster: false,
        fit: expect.objectContaining({
          bounds: [
            [1, 41.98],
            [2.82, 42],
          ],
        }),
      }),
    );

    // El número del marcador és el de la fila: la millor hora.
    expect(mockNightMap).toHaveBeenLastCalledWith(
      expect.objectContaining({
        points: expect.objectContaining({
          features: expect.arrayContaining([
            expect.objectContaining({
              properties: expect.objectContaining({
                id: 'montsec',
                index: { valor: 87, franja: 'ras' },
              }),
            }),
            expect.objectContaining({
              properties: expect.objectContaining({ id: 'cadi', index: null }),
            }),
          ]),
        }),
      }),
    );

    await fireEvent.press(screen.getByRole('button', { name: "Mostra'ls tots" }));
    expect(
      screen.getByRole('button', { name: /^4t: Serra del Cadí. Encara sense previsió/ }),
    ).toBeOnTheScreen();

    await fireEvent.press(montsec);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/punt/[id]', params: { id: 'montsec' } });
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('recommendations.showLess') }));
    expect(screen.queryByRole('button', { name: /^4t: Serra del Cadí/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^1r: Serra del Montsec/ })).toBeOnTheScreen();
  });

  it('el full es plega per veure el mapa, i la càmera aprofita l’espai', async () => {
    mockRecommendations = {
      ...mockRecommendations,
      isPending: false,
      isFetching: false,
      data: resposta([
        punt('montsec', 'Serra del Montsec', 87, 135),
        punt('prades', 'Muntanyes de Prades', 81, 100),
      ]),
    };
    await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    const lastFit = () =>
      (mockNightMap.mock.calls.at(-1)![0] as { fit: { padding: { bottom: number } } }).fit;
    const open = lastFit().padding.bottom;

    await fireEvent.press(screen.getByRole('button', { name: 'Plega la llista' }));
    expect(screen.queryByText('Serra del Montsec')).toBeNull();
    expect(lastFit().padding.bottom).toBeLessThan(open);

    await fireEvent.press(screen.getByRole('button', { name: 'Desplega la llista' }));
    expect(screen.getByText('Serra del Montsec')).toBeOnTheScreen();
    expect(lastFit().padding.bottom).toBe(open);
  });

  it('mentre carrega ho diu, i si falla es pot tornar a provar', async () => {
    const { rerender } = await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    expect(screen.getByLabelText('Buscant els millors punts…')).toBeOnTheScreen();

    mockRecommendations = {
      ...mockRecommendations,
      isPending: false,
      isFetching: false,
      isError: true,
    };
    await rerender(<MapScreen />);
    expect(screen.getByText('No hem pogut carregar les recomanacions')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Torna-ho a provar' }));
    expect(mockRefetchRecommendations).toHaveBeenCalledTimes(1);
  });

  it('sense cap punt dins del radi, proposa ampliar la distància', async () => {
    mockRecommendations = {
      ...mockRecommendations,
      isPending: false,
      isFetching: false,
      data: resposta([]),
    };
    await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    expect(screen.getByText('No hi ha cap punt a menys de 2 h 30 min')).toBeOnTheScreen();
    expect(screen.getByText('Amplia la distància o tria una altra nit.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: "Mostra'ls tots" })).toBeNull();
  });

  it('mostra el fenomen, la nit resolta per l’API i els punts sense previsió per distància', async () => {
    const name = 'Eclipsi lunar penombral, visible sencer des de tot Catalunya i les Illes';
    mockParams = {
      esdevenimentId: 'eclipsi-2027',
      eventName: name,
      eventWhen: 'Nit del 20 al 21 de febrer',
      lat: '41.98',
      lon: '2.82',
      lloc: 'Girona',
    };
    mockRecommendations = {
      ...mockRecommendations,
      isPending: false,
      isFetching: false,
      data: {
        ...resposta([punt('montsec', 'Serra del Montsec', null, 45)]),
        data: '2027-02-20',
        tempsMaxim: null,
        radiKm: null,
        avis: 'sense_previsio',
        esdeveniment: { id: 'eclipsi-2027', inici: at(22), maxim: null, fi: at(6) },
      },
    };
    await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    expect(screen.getByRole('header', { name: /Eclipsi lunar penombral/ })).toBeOnTheScreen();
    expect(screen.getByText(name).props.numberOfLines).toBeUndefined();
    expect(screen.getByText('ds. 20 febr.')).toBeOnTheScreen();
    expect(screen.getByText('Rànquing de millors punts')).toBeOnTheScreen();
    expect(screen.getByText('Des de Girona · sense límit de distància')).toBeOnTheScreen();
    expect(screen.getByText('80 km en línia recta')).toBeOnTheScreen();
    const notice = screen.getByText(i18n.t('recommendations.noEventForecast'));
    expect(notice.props.numberOfLines).toBeUndefined();
    const row = screen.getByRole('button', {
      name: /^1r: Serra del Montsec. Encara sense previsió/,
    });
    // Sense previsió cap punt es destaca com si fos el millor per observar.
    expect(StyleSheet.flatten(row.props.style).backgroundColor).toBeUndefined();
    expect(mockNightMap).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cluster: false,
        points: expect.objectContaining({
          features: [
            expect.objectContaining({
              properties: expect.objectContaining({ id: 'montsec', index: null }),
            }),
          ],
        }),
      }),
    );
    await fireEvent.press(row);
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/punt/[id]',
      params: { id: 'montsec' },
    });
    expect(screen.queryByText('Amaga el rànquing')).toBeNull();
    await fireEvent(screen.getByTestId('ranking-sheet'), 'layout', {
      nativeEvent: { layout: { height: 360 } },
    });
    await act(() =>
      fireGestureHandler(getByGestureTestId('ranking-sheet-pan'), [
        { state: State.BEGAN, translationY: 0 },
        { state: State.ACTIVE, translationY: 0 },
        { state: State.ACTIVE, translationY: 250 },
        { state: State.END, translationY: 250, velocityY: 0 },
      ]),
    );
    expect(screen.queryByText(i18n.t('recommendations.noEventForecast'))).toBeNull();
    expect(screen.queryByText('Rànquing de millors punts')).toBeNull();
    expect(screen.getByRole('button', { name: 'Mostra el rànquing' })).toBeOnTheScreen();
    expect(screen.getByTestId('night-map')).toBeOnTheScreen();
    expect(screen.queryByText('Mostra el rànquing')).toBeNull();
    await act(() =>
      fireGestureHandler(getByGestureTestId('ranking-sheet-pan'), [
        { state: State.BEGAN, translationY: 0 },
        { state: State.ACTIVE, translationY: 0 },
        { state: State.ACTIVE, translationY: -250 },
        { state: State.END, translationY: -250, velocityY: 0 },
      ]),
    );
    expect(screen.getByText('Rànquing de millors punts')).toBeOnTheScreen();
    expect(screen.getByText(i18n.t('recommendations.noEventForecast'))).toBeOnTheScreen();
  });

  it('manté la data preomplerta durant la càrrega i permet reintentar un error', async () => {
    mockParams = {
      esdevenimentId: 'leonids-2026',
      eventName: 'Leònids',
      eventWhen: '18 de novembre',
      lat: '41.98',
      lon: '2.82',
    };
    const { rerender } = await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    expect(screen.getByText('Leònids')).toBeOnTheScreen();
    expect(screen.getByText('18 de novembre')).toBeOnTheScreen();
    expect(screen.getByLabelText('Buscant els millors punts…')).toBeOnTheScreen();
    mockRecommendations = {
      ...mockRecommendations,
      isPending: false,
      isFetching: false,
      isError: true,
    };
    await rerender(<MapScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Torna-ho a provar' }));
    expect(mockRefetchRecommendations).toHaveBeenCalledTimes(1);
  });

  it.each(['ca', 'es', 'en'])(
    'explica qualitat i proximitat i mostra la distància en %s',
    async (language) => {
      await i18n.changeLanguage(language);
      mockParams = {
        esdevenimentId: 'leonids-2026',
        eventName: 'Leònids',
        lat: '41.98',
        lon: '2.82',
      };
      mockRecommendations = {
        ...mockRecommendations,
        isPending: false,
        isFetching: false,
        data: {
          ...resposta([{ ...punt('prop', 'Punt proper', 85, 20), distanciaKm: 1.2 }]),
          tempsMaxim: null,
          radiKm: null,
        },
      };
      await render(<MapScreen />, { wrapper: GestureHandlerRootView });
      expect(screen.getByText(i18n.t('recommendations.eventRanking'))).toBeOnTheScreen();
      const hint = screen.getByText(i18n.t('recommendations.qualityDistanceHint'));
      expect(hint.props.numberOfLines).toBeUndefined();
      expect(screen.getByText(i18n.t('recommendations.fromHereUnlimited'))).toBeOnTheScreen();
      const distance = i18n.t('recommendations.distance', {
        km: language === 'en' ? '1.2' : '1,2',
      });
      expect(screen.getByText(distance)).toBeOnTheScreen();
      expect(screen.getByText(distance).props.numberOfLines).toBeUndefined();
      expect(
        screen.getByRole('button', { name: new RegExp(distance.replace('.', '\\.')) }),
      ).toBeOnTheScreen();
    },
  );

  it('sense cap punt publicat no anuncia un radi ni proposa ampliar un límit inexistent', async () => {
    mockParams = {
      esdevenimentId: 'leonids-2026',
      eventName: 'Leònids',
      lat: '41.98',
      lon: '2.82',
    };
    mockRecommendations = {
      ...mockRecommendations,
      isPending: false,
      isFetching: false,
      data: { ...resposta([]), tempsMaxim: null, radiKm: null },
    };
    await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    expect(screen.getByText('Encara no hi ha punts disponibles')).toBeOnTheScreen();
    expect(screen.getByText('Torna-ho a provar més endavant.')).toBeOnTheScreen();
  });

  it.each(['ios', 'android'] as const)(
    'el full respecta el menú inferior a %s sense duplicar-ne el marge',
    async (platform) => {
      const original = Platform.OS;
      Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
      try {
        await render(<MapScreen />, { wrapper: GestureHandlerRootView });
        const safeArea = screen.getByTestId('ranking-safe-area');
        if (platform === 'ios') expect(safeArea.props.edges).toMatchObject({ bottom: true });
        else expect(safeArea.props.edges).toBeUndefined();
        expect(
          StyleSheet.flatten(screen.getByTestId('ranking-sheet').props.style).paddingBottom,
        ).toBe(8);
        await fireEvent.press(screen.getByRole('button', { name: 'Plega la llista' }));
        expect(screen.getByRole('button', { name: 'Desplega la llista' })).toBeOnTheScreen();
        await fireEvent.press(screen.getByRole('button', { name: 'Desplega la llista' }));
        expect(screen.getByRole('button', { name: 'Plega la llista' })).toBeOnTheScreen();
      } finally {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
      }
    },
  );

  it('el lector de pantalla pot plegar i recuperar el full sense arrossegar-lo', async () => {
    await render(<MapScreen />, { wrapper: GestureHandlerRootView });
    await fireEvent(
      screen.getByRole('button', { name: 'Plega la llista' }),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'activate' },
      },
    );
    expect(screen.queryByLabelText('Buscant els millors punts…')).toBeNull();
    await fireEvent(
      screen.getByRole('button', { name: 'Desplega la llista' }),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'activate' },
      },
    );
    expect(screen.getByLabelText('Buscant els millors punts…')).toBeOnTheScreen();
    await fireEvent(screen.getByRole('button', { name: 'Plega la llista' }), 'accessibilityEscape');
    expect(screen.getByRole('button', { name: 'Desplega la llista' })).toBeOnTheScreen();
    expect(screen.getByTestId('night-map')).toBeOnTheScreen();
  });
});
