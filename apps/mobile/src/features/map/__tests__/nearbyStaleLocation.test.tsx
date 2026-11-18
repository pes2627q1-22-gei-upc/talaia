import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';

import i18n from '@/core/i18n';

import { useMapViewModel } from '../useMapViewModel';

// La ubicació de veritat (`useCurrentPlaceQuery` amb React Query): només es simula el GPS.
jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('../useDeviceHeading', () => ({
  useDeviceHeading: () => ({ heading: null, active: false }),
}));
jest.mock('../../recommendations/useRecommendationsViewModel', () => ({
  useRecommendationsViewModel: () => null,
}));
jest.mock('../mapRepository', () => ({
  useMapPointsQuery: () => ({
    data: { type: 'FeatureCollection', features: [] },
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
}));

const location = jest.mocked(Location);
const at = (latitude: number, longitude: number, city: string) => {
  location.getLastKnownPositionAsync.mockResolvedValueOnce({
    coords: { latitude, longitude },
  } as Location.LocationObject);
  location.reverseGeocodeAsync.mockResolvedValueOnce([
    { city } as Location.LocationGeocodedAddress,
  ]);
};

describe('«A prop meu» amb una ubicació que caduca (HU02)', () => {
  let client: QueryClient;
  function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    await i18n.changeLanguage('ca');
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    jest.mocked(router.push).mockClear();
    location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
      canAskAgain: true,
    } as Location.LocationPermissionResponse);
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    jest.useRealTimers();
  });

  /** Deixa córrer les promeses pendents sense avançar el rellotge. */
  const flush = () =>
    act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

  it('passats 5 minuts sense cap render, torna a llegir on és abans d’obrir el rànquing', async () => {
    at(41.38712, 2.16994, 'Barcelona');
    const { result } = await renderHook(() => useMapViewModel(), { wrapper: QueryWrapper });
    await flush();
    expect(result.current.userLocation).toEqual({ lat: 41.38712, lon: 2.16994 });

    // Mentrestant l'usuari s'ha mogut fins a Girona, i res no ha tornat a pintar el mapa.
    at(41.98123, 2.82456, 'Girona');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(6 * 60 * 1000);
    });
    await act(async () => result.current.nearby?.onPress());
    await flush();

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/recomanacions',
      params: { aprop: 'aqui', lat: '41.981', lon: '2.825', lloc: 'Girona' },
    });
  });
});
