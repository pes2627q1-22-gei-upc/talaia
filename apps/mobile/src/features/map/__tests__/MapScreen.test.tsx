import type { Recomanacio, RecomanacionsResposta } from '@talaia/shared';
import { router } from 'expo-router';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import i18n from '@/core/i18n';

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
}));

const mockRefetchRecommendations = jest.fn();
let mockRecommendations = {
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

jest.mock('../../explore/locationRepository', () => ({
  useCurrentPlaceQuery: () => ({ data: undefined, isError: false }),
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

  it("passa l'estil nocturn, la càmera i l'etiqueta accessible al mapa", async () => {
    await render(<MapScreen />);
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
    await render(<MapScreen />);
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
    await render(<MapScreen />);
    expect(screen.getByText('Carregant llocs d’observació…')).toBeOnTheScreen();
  });

  it('mostra l’estat buit sense controls de prova', async () => {
    mockQuery = {
      ...mockQuery,
      data: { type: 'FeatureCollection', features: [] },
      isPending: false,
      isFetching: false,
    };
    await render(<MapScreen />);
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
    const { rerender } = await render(<MapScreen />);
    expect(screen.queryByText('Encara no hi ha llocs disponibles')).toBeNull();
    expect(screen.queryByText('Carregant llocs d’observació…')).toBeNull();
    mockQuery = { ...mockQuery, isError: true };
    await rerender(<MapScreen />);
    expect(screen.getByText('No hem pogut carregar els llocs')).toBeOnTheScreen();
    expect(mockNightMap).toHaveBeenLastCalledWith(expect.objectContaining({ points }));
    mockQuery = { ...mockQuery, isFetching: true };
    await rerender(<MapScreen />);
    expect(screen.getByText('Carregant llocs d’observació…')).toBeOnTheScreen();
    expect(
      screen.getByTestId('map-loading-indicator', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Torna-ho a provar' })).toBeNull();
  });

  it('permet tornar a provar sense amagar el mapa quan falla l’API', async () => {
    mockQuery = { ...mockQuery, isPending: false, isError: true, isFetching: false };
    await render(<MapScreen />);
    expect(screen.getByTestId('night-map')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Torna-ho a provar' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('el botó enrere torna a «Què vols veure?»', async () => {
    await render(<MapScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Enrere' }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});

describe('MapScreen amb una cerca (TG-102, mockup 03)', () => {
  /** Hora local fixa, sigui quina sigui la zona del sistema on corren els tests. */
  const at = (hour: number) => new Date(2026, 9, 22, hour, 0).toISOString();
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
    await render(<MapScreen />);

    expect(screen.getByRole('header', { name: /Pluja d'estels, aquesta nit/ })).toBeOnTheScreen();
    expect(screen.getByText('Des de Girona, fins a 2 h 30 min')).toBeOnTheScreen();
    expect(screen.getByText('Justet')).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Millors punts per a aquesta nit' }),
    ).toBeOnTheScreen();
    // Sense cerca no hi ha l'avís del catàleg, encara que `/punts` no hagi carregat.
    expect(screen.queryByText('Carregant llocs d’observació…')).toBeNull();

    const montsec = screen.getByRole('button', { name: /^1r: Serra del Montsec/ });
    expect(montsec).toHaveAccessibleName(
      '1r: Serra del Montsec. Índex de visibilitat: 87 de 100, Cel ras. Millor hora: 02:00. 2 h 15 min en cotxe',
    );
    expect(screen.queryByText('Serra del Cadí')).toBeNull();

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

    await fireEvent.press(screen.getByRole('button', { name: "Veure'ls tots" }));
    expect(
      screen.getByRole('button', { name: /^4t: Serra del Cadí. Encara sense previsió/ }),
    ).toBeOnTheScreen();

    await fireEvent.press(montsec);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/punt/[id]', params: { id: 'montsec' } });
  });

  it('mentre carrega ho diu, i si falla es pot tornar a provar', async () => {
    const { rerender } = await render(<MapScreen />);
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
    await render(<MapScreen />);
    expect(screen.getByText('No hi ha cap punt a menys de 2 h 30 min')).toBeOnTheScreen();
    expect(screen.getByText('Amplia la distància o tria una altra nit.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: "Veure'ls tots" })).toBeNull();
  });
});
