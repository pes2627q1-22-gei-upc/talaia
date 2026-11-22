import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AppState, type AppStateStatus, Linking } from 'react-native';

import i18n from '@/core/i18n';

import type { CurrentPlace } from '../../explore/locationRepository';
import type { RecommendationParams } from '../../recommendations/recommendationsModel';

import { nightStyle } from '../style/nightStyle';
import { useMapViewModel } from '../useMapViewModel';

let mockLocation: {
  data?: CurrentPlace;
  isError: boolean;
  isStale?: boolean;
  refetch?: jest.Mock;
};
let mockParams: RecommendationParams = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('../useDeviceHeading', () => ({
  useDeviceHeading: () => ({ heading: null, active: true }),
}));

jest.mock('../../explore/locationRepository', () => ({
  useCurrentPlaceQuery: () => mockLocation,
}));

// L'índex d'un lloc triat (HU05) es prova a useMapSpot i a MapScreen.
jest.mock('../visibilityRepository', () => ({
  useVisibilityQuery: () => ({ data: undefined, isError: false, error: null, refetch: jest.fn() }),
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
    // Ja no tria l'origen: un altre toc tria un lloc per veure'n l'índex (HU05).
    await act(async () => result.current.onMapPress?.(41.5, 2));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(result.current.spot).not.toBeNull();
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

  it('amb una ubicació antiga, la torna a llegir abans d’obrir el rànquing', async () => {
    const girona: CurrentPlace = {
      status: 'ready',
      place: { lat: 41.98123, lon: 2.82456, name: 'Girona' },
    };
    mockLocation = { data: ready, isError: false, isStale: true, refetch: resolves(girona) };
    const { result } = await renderHook(() => useMapViewModel());
    await act(async () => result.current.nearby?.onPress());
    expect(mockLocation.refetch).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/recomanacions',
      params: { aprop: 'aqui', lat: '41.981', lon: '2.825', lloc: 'Girona' },
    });
  });

  it('si surt del mapa mentre busca, no obre el rànquing', async () => {
    let arrive!: (value: { data: CurrentPlace; isError: boolean }) => void;
    const refetch = jest.fn(() => new Promise((resolve) => (arrive = resolve)));
    mockLocation = { data: undefined, isError: false, refetch };
    const { result, unmount } = await renderHook(() => useMapViewModel());
    await act(async () => result.current.nearby?.onPress());
    await act(async () => unmount());
    await act(async () => arrive({ data: ready, isError: false }));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('tornant de la configuració mentre tria, torna a llegir la ubicació', async () => {
    let change: ((state: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      change = handler as (state: AppStateStatus) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    const refetch = resolves(denied(false));
    mockLocation = { data: denied(false), isError: false, refetch };
    const { result } = await renderHook(() => useMapViewModel());
    expect(change).toBeUndefined();
    await act(async () => result.current.nearby?.onPress());
    expect(result.current.picker).not.toBeNull();
    refetch.mockClear();
    await act(async () => change?.('active'));
    expect(refetch).toHaveBeenCalledTimes(1);
    jest.mocked(AppState.addEventListener).mockRestore();
  });

  it('amb un rànquing triat al mapa, el mapa marca el punt de sortida', async () => {
    mockParams = { aprop: 'triat', lat: '41.981', lon: '2.825' };
    const { result } = await renderHook(() => useMapViewModel());
    expect(result.current.origin).toEqual({
      lat: 41.981,
      lon: 2.825,
      label: 'Punt de sortida',
    });
    mockParams = { aprop: 'aqui', lat: '41.981', lon: '2.825' };
    const { result: here } = await renderHook(() => useMapViewModel());
    expect(here.current.origin).toBeNull();
  });
});

describe('punt triat al mapa (HU05, mockup 04)', () => {
  const ready: CurrentPlace = {
    status: 'ready',
    place: { lat: 41.38712, lon: 2.16994, name: 'Barcelona' },
  };

  beforeEach(async () => {
    mockParams = {};
    mockPoints = [];
    jest.mocked(router.push).mockClear();
    await i18n.changeLanguage('ca');
  });

  it('sense cerca, un toc al mapa tria el lloc: el marca i la targeta substitueix «A prop meu»', async () => {
    mockLocation = { data: ready, isError: false, refetch: jest.fn() };
    const { result } = await renderHook(() => useMapViewModel());
    expect(result.current.hint).toEqual({
      title: 'Tria un punt al mapa',
      subtitle: "Toca on vulguis per veure'n l'índex",
    });
    expect(result.current.spot).toBeNull();
    await act(async () => result.current.onMapPress?.(42.01, 1.31));
    expect(result.current.spot).toMatchObject({ title: 'Punt triat al mapa' });
    expect(result.current.nearby).toBeNull();
    expect(result.current.origin).toEqual({
      lat: 42.01,
      lon: 1.31,
      label: 'Punt triat',
    });
    expect(router.push).not.toHaveBeenCalled();
    await act(async () => result.current.spot?.onClose());
    expect(result.current.spot).toBeNull();
    expect(result.current.origin).toBeNull();
    expect(result.current.nearby?.label).toBe('A prop meu');
  });

  it('un toc mentre «A prop meu» busca la ubicació la deixa córrer', async () => {
    let arrive!: (value: { data: CurrentPlace; isError: boolean }) => void;
    const refetch = jest.fn(() => new Promise((resolve) => (arrive = resolve)));
    mockLocation = { data: undefined, isError: false, refetch };
    const { result } = await renderHook(() => useMapViewModel());
    await act(async () => result.current.nearby?.onPress());
    await act(async () => result.current.onMapPress?.(42.01, 1.31));
    await act(async () => arrive({ data: ready, isError: false }));
    expect(router.push).not.toHaveBeenCalled();
    expect(result.current.spot).not.toBeNull();
  });
});
