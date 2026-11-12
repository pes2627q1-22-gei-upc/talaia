import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking } from 'react-native';

import i18n from '@/core/i18n';
import { colors } from '@/core/theme/tokens';

import type { CurrentPlace } from '../../explore/locationRepository';
import type { RecommendationParams } from '../../recommendations/recommendationsModel';

import { nightStyle } from '../style/nightStyle';
import { useMapViewModel } from '../useMapViewModel';

let mockLocation: {
  data?: CurrentPlace;
  isError: boolean;
  refetch?: jest.Mock;
};
let mockParams: RecommendationParams = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../useDeviceHeading', () => ({
  useDeviceHeading: () => ({ heading: null, active: true }),
}));

jest.mock('../../explore/locationRepository', () => ({
  useCurrentPlaceQuery: () => mockLocation,
}));

// Sense cerca a la ruta («Mostra el mapa»): el rànquing es prova a MapScreen i al seu ViewModel.
jest.mock('../../recommendations/useRecommendationsViewModel', () => ({
  useRecommendationsViewModel: () => null,
}));

let mockPoints: import('../pointMarkers').MapPoints['features'];
jest.mock('../mapRepository', () => ({
  useMapPointsQuery: () => ({
    data: { type: 'FeatureCollection', features: mockPoints },
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
}));

describe('useMapViewModel', () => {
  beforeEach(async () => {
    mockLocation = { data: undefined, isError: false };
    mockParams = {};
    mockPoints = [];
    jest.mocked(router.push).mockClear();
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

  it('de dia avisa que l’índex comença a la posta', async () => {
    mockPoints = [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0.75, 42.05] },
        properties: {
          id: 'montsec',
          nom: 'Serra del Montsec',
          municipi: 'Àger',
          index: { valor: 0, franja: 'tap', deDia: true },
        },
      },
    ];
    const { result } = await renderHook(() => useMapViewModel());
    expect(result.current.notice).toMatchObject({ kind: 'daytime', title: 'És de dia' });
  });
});

describe('«A prop meu» des del mapa (HU02)', () => {
  const ready: CurrentPlace = {
    status: 'ready',
    place: { lat: 41.38712, lon: 2.16994, name: 'Barcelona' },
  };
  const denied = (canAskAgain: boolean): CurrentPlace => ({ status: 'denied', canAskAgain });
  /** El que torna `refetch`: la ubicació que s'acaba de saber, o un error. */
  const resolves = (data?: CurrentPlace, isError = false) =>
    jest.fn(async () => ({ data, isError }));

  beforeEach(async () => {
    mockParams = {};
    mockPoints = [];
    jest.mocked(router.push).mockClear();
    await i18n.changeLanguage('ca');
  });

  it('amb la ubicació, obre el rànquing des d’on és l’usuari', async () => {
    mockLocation = { data: ready, isError: false, refetch: resolves(ready) };
    const { result } = await renderHook(() => useMapViewModel());
    expect(result.current.nearby).toMatchObject({
      label: 'A prop meu',
      hint: 'Mostra els millors punts a prop teu',
      loading: false,
    });
    expect(result.current.picker).toBeNull();
    expect(result.current.onMapPress).toBeUndefined();
    await act(async () => result.current.nearby?.onPress());
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/recomanacions',
      params: { aprop: 'aqui', lat: '41.387', lon: '2.17', lloc: 'Barcelona' },
    });
    expect(mockLocation.refetch).not.toHaveBeenCalled();
  });

  it('si encara la busca, espera i després l’obre', async () => {
    let arrive!: (value: { data: CurrentPlace; isError: boolean }) => void;
    const refetch = jest.fn(() => new Promise((resolve) => (arrive = resolve)));
    mockLocation = { data: undefined, isError: false, refetch };
    const { result } = await renderHook(() => useMapViewModel());
    await act(async () => result.current.nearby?.onPress());
    expect(refetch).toHaveBeenCalledWith({ cancelRefetch: false });
    expect(result.current.nearby?.loading).toBe(true);
    // Un segon toc mentre busca no en llança un altre.
    await act(async () => result.current.nearby?.onPress());
    expect(refetch).toHaveBeenCalledTimes(1);
    await act(async () =>
      arrive({ data: { ...ready, place: { ...ready.place, name: '' } }, isError: false }),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/recomanacions',
      params: { aprop: 'aqui', lat: '41.387', lon: '2.17' },
    });
    expect(result.current.nearby?.loading).toBe(false);
  });

  it('sense permís, demana triar al mapa i el lloc tocat fa d’origen', async () => {
    mockLocation = { data: denied(false), isError: false, refetch: resolves(denied(false)) };
    const { result } = await renderHook(() => useMapViewModel());
    await act(async () => result.current.nearby?.onPress());
    expect(result.current.nearby).toBeNull();
    expect(result.current.picker).toMatchObject({
      title: "Toca el mapa per triar d'on surts",
      description:
        'No tenim la teva ubicació: buscarem els millors punts a prop del lloc que toquis.',
      action: { label: 'Obre la configuració' },
      closeLabel: 'Tanca',
    });
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    result.current.picker?.action.onPress();
    expect(openSettings).toHaveBeenCalled();
    await act(async () => result.current.onMapPress?.(41.98123, 2.82456));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/recomanacions',
      params: { aprop: 'triat', lat: '41.981', lon: '2.825' },
    });
    expect(result.current.picker).toBeNull();
    expect(result.current.onMapPress).toBeUndefined();
  });

  it('si el sistema encara ho deixa, torna a demanar el permís; i es pot tancar', async () => {
    const refetch = resolves(denied(true));
    mockLocation = { data: denied(true), isError: false, refetch };
    const { result } = await renderHook(() => useMapViewModel());
    await act(async () => result.current.nearby?.onPress());
    expect(result.current.picker?.action.label).toBe('Permet la ubicació');
    refetch.mockImplementationOnce(async () => ({ data: ready, isError: false }));
    await act(async () => result.current.picker?.action.onPress());
    expect(router.push).toHaveBeenLastCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ aprop: 'aqui' }) }),
    );
    await act(async () => result.current.nearby?.onPress());
    expect(result.current.picker).not.toBeNull();
    await act(async () => result.current.picker?.onClose());
    expect(result.current.picker).toBeNull();
    expect(result.current.nearby?.label).toBe('A prop meu');
  });

  it('si el GPS falla, ho diu i deixa tornar-ho a provar', async () => {
    mockLocation = { data: undefined, isError: true, refetch: resolves(undefined, true) };
    const { result } = await renderHook(() => useMapViewModel());
    await act(async () => result.current.nearby?.onPress());
    expect(result.current.picker).toMatchObject({
      description: 'No hem trobat on ets: buscarem els millors punts a prop del lloc que toquis.',
      action: { label: 'Torna-ho a provar' },
    });
  });

  it('amb un rànquing triat al mapa, el mapa marca el punt de sortida', async () => {
    mockParams = { aprop: 'triat', lat: '41.981', lon: '2.825' };
    const { result } = await renderHook(() => useMapViewModel());
    expect(result.current.origin).toEqual({
      lat: 41.981,
      lon: 2.825,
      label: 'Punt de sortida',
      color: colors.far,
    });
    mockParams = { aprop: 'aqui', lat: '41.981', lon: '2.825' };
    const { result: here } = await renderHook(() => useMapViewModel());
    expect(here.current.origin).toBeNull();
  });
});
