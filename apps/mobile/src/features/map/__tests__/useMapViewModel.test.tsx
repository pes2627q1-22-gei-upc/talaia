import { renderHook } from '@testing-library/react-native';

import i18n from '@/core/i18n';

import { nightStyle } from '../style/nightStyle';
import { useMapViewModel } from '../useMapViewModel';

let mockLocation: {
  data?: import('../../explore/locationRepository').CurrentPlace;
  isError: boolean;
};
jest.mock('../useDeviceHeading', () => ({
  useDeviceHeading: () => ({ heading: null, active: true }),
}));

jest.mock('../../explore/locationRepository', () => ({
  useCurrentPlaceQuery: () => mockLocation,
}));

// Sense cerca a la ruta («Veure el mapa»): el rànquing es prova a MapScreen i al seu ViewModel.
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

describe('useMapViewModel', () => {
  beforeEach(async () => {
    mockLocation = { data: undefined, isError: false };
    await i18n.changeLanguage('ca');
  });

  it('passa la ubicació disponible al mapa sense una etiqueta visible', async () => {
    mockLocation = {
      data: { status: 'ready', place: { lat: 41.39, lon: 2.17, name: 'Barcelona' } },
      isError: false,
    };
    const { result } = await renderHook(() => useMapViewModel());
    expect(result.current.userLocation).toEqual({ lat: 41.39, lon: 2.17 });
    expect(result.current.userLocationLabel).toBe('La teva ubicació');
  });

  it('manté el mapa disponible sense ubicació si es denega el permís', async () => {
    mockLocation = { data: { status: 'denied', canAskAgain: false }, isError: false };
    const { result } = await renderHook(() => useMapViewModel());
    expect(result.current.userLocation).toBeNull();
    expect(result.current.mapStyle).toBe(nightStyle);
  });

  it('no mostra una ubicació antiga quan falla la consulta', async () => {
    mockLocation = {
      data: { status: 'ready', place: { lat: 41, lon: 2, name: '' } },
      isError: true,
    };
    const { result } = await renderHook(() => useMapViewModel());
    expect(result.current.userLocation).toBeNull();
  });

  it("dona l'estil nocturn i una càmera dins dels límits de Catalunya", async () => {
    const { result } = await renderHook(() => useMapViewModel());
    const { center, zoom, minZoom, maxZoom, maxBounds } = result.current.camera;
    const [west, south, east, north] = maxBounds;
    const [lng, lat] = center;

    expect(result.current.mapStyle).toBe(nightStyle);
    expect(lng).toBeGreaterThan(west);
    expect(lng).toBeLessThan(east);
    expect(lat).toBeGreaterThan(south);
    expect(lat).toBeLessThan(north);
    expect(zoom).toBeGreaterThanOrEqual(minZoom);
    expect(zoom).toBeLessThanOrEqual(maxZoom);
    expect(result.current.accessibilityLabel).toBe('Mapa nocturn de Catalunya amb el relleu');
    expect(result.current.notice?.title).toBe('Encara no hi ha llocs disponibles');
  });
});
