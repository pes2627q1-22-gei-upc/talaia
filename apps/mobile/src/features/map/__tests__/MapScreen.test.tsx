import { router } from 'expo-router';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import i18n from '@/core/i18n';

import { MapScreen } from '../MapScreen';
import type { MapPoints } from '../pointMarkers';
import { nightStyle } from '../style/nightStyle';
import { camera } from '../useMapViewModel';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

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
    jest.mocked(router.push).mockClear();
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
});
