/** @jest-environment jsdom */
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl from 'maplibre-gl';

import PointLocationMapContent, {
  ORBIT_DEGREES_PER_MS,
  ORBIT_RAMP_MS,
  POINT_VIEW,
} from '../PointLocationMapContent';

jest.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
jest.mock('maplibre-gl', () => ({
  __esModule: true,
  default: { Map: jest.fn(), Marker: jest.fn() },
}));

const props: ComponentProps<typeof PointLocationMapContent> = {
  mapStyle: { version: 8, sources: {}, layers: [] },
  coordinates: { lat: 41.9, lon: 0.8 },
  palette: {
    background: '#10142c',
    text: '#fff',
    link: '#5fd4c4',
    marker: '#5fd4c4',
    shadow: '#00000047',
    markerPulse: '#5FD4C4B8',
    markerGlow: '#5FD4C4B3',
    markerHalo: '#5FD4C42E',
  },
  metrics: { touch: 44, icon: 22, marker: 66, core: 43, stem: 18, halo: 10, top: 59 },
  label: 'Serra del Montsec',
  attributionLabel: 'Crèdits del mapa',
  unavailableLabel: 'Mapa no disponible',
  orbit: false,
};

let root: Root;
let host: HTMLDivElement;
let mapContainer: HTMLDivElement;
let handlers: Record<string, () => void>;
let bearing: number;
let map: {
  getContainer: jest.Mock;
  on: jest.Mock;
  areTilesLoaded: jest.Mock;
  remove: jest.Mock;
  getBearing: jest.Mock;
  setBearing: jest.Mock;
  setPadding: jest.Mock;
};
let marker: { setLngLat: jest.Mock; addTo: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  mapContainer = document.createElement('div');
  handlers = {};
  map = {
    getContainer: jest.fn(() => mapContainer),
    on: jest.fn((event: string, handler: () => void) => {
      handlers[event] = handler;
    }),
    areTilesLoaded: jest.fn(() => true),
    remove: jest.fn(),
    getBearing: jest.fn(() => bearing),
    setBearing: jest.fn((value: number) => {
      bearing = value;
    }),
    setPadding: jest.fn(),
  };
  bearing = POINT_VIEW.bearing;
  marker = { setLngLat: jest.fn().mockReturnThis(), addTo: jest.fn().mockReturnThis() };
  jest.mocked(maplibregl.Map).mockImplementation(() => map as unknown as maplibregl.Map);
  jest.mocked(maplibregl.Marker).mockImplementation(() => marker as unknown as maplibregl.Marker);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it('centra el mapa inclinat sobre el relleu, situa la talaia i permet obrir i tancar els crèdits', async () => {
  await act(async () => root.render(<PointLocationMapContent {...props} />));

  expect(maplibregl.Map).toHaveBeenCalledWith(
    expect.objectContaining({
      center: [0.8, 41.9],
      ...POINT_VIEW,
      interactive: false,
      attributionControl: false,
    }),
  );
  expect(marker.setLngLat).toHaveBeenCalledWith([0.8, 41.9]);
  // El punt, al centre de la part visible: sota la zona segura i el botó enrere.
  expect(map.setPadding).toHaveBeenCalledWith({ top: 59 + 44, bottom: 0, left: 0, right: 0 });
  expect(marker.addTo).toHaveBeenCalledWith(map);
  expect(
    jest.mocked(maplibregl.Marker).mock.calls[0]?.[0]?.element?.getAttribute('aria-label'),
  ).toBe(props.label);

  const button = mapContainer.querySelector<HTMLButtonElement>('button');
  const panel = mapContainer.querySelector<HTMLElement>('[role="region"]');
  expect(button?.getAttribute('aria-label')).toBe(props.attributionLabel);
  expect(host.querySelector('style')?.textContent).toContain('width: 44px; height: 44px');
  // Els crèdits van a dalt a la dreta, sota la barra d'estat, on no toquen el botó enrere.
  expect(host.querySelector('style')?.textContent).toContain('top: 59px; right: 8px');
  expect(host.querySelector('style')?.textContent).not.toContain('color-mix');
  expect(button?.getAttribute('aria-expanded')).toBe('false');
  expect(panel?.hidden).toBe(true);
  button?.click();
  expect(panel?.hidden).toBe(false);
  expect(button?.getAttribute('aria-expanded')).toBe('true');
  button?.click();
  expect(panel?.hidden).toBe(true);
  expect(button?.getAttribute('aria-expanded')).toBe('false');

  await act(async () => root.unmount());
  expect(map.remove).toHaveBeenCalledTimes(1);
  expect(mapContainer.querySelector('.talaia-map-credits')).toBeNull();
});

it('mostra un avís si fallen les tessel·les i l’amaga quan es recuperen', async () => {
  await act(async () => root.render(<PointLocationMapContent {...props} />));
  const status = host.querySelector<HTMLElement>('[role="status"]');
  expect(status?.hidden).toBe(true);
  handlers.error?.();
  expect(status?.hidden).toBe(false);
  map.areTilesLoaded.mockReturnValueOnce(false);
  handlers.idle?.();
  expect(status?.hidden).toBe(false);
  handlers.idle?.();
  expect(status?.hidden).toBe(true);
});

it('mostra un avís quan el mapa no es pot inicialitzar', async () => {
  jest.mocked(maplibregl.Map).mockImplementationOnce(() => {
    throw new Error('WebGL unavailable');
  });
  await act(async () => root.render(<PointLocationMapContent {...props} />));
  expect(host.querySelector<HTMLElement>('[role="status"]')?.hidden).toBe(false);
  expect(maplibregl.Marker).not.toHaveBeenCalled();
});

describe('òrbita', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const advance = (ms: number) => act(async () => jest.advanceTimersByTime(ms));

  it('gira al voltant del punt quan el mapa ha carregat, i arrenca a poc a poc', async () => {
    await act(async () => root.render(<PointLocationMapContent {...props} orbit />));
    await advance(1_000);
    // Fins que no ha carregat l'estil, no es mou.
    expect(map.setBearing).not.toHaveBeenCalled();

    await act(async () => handlers.load?.());
    await advance(ORBIT_RAMP_MS / 4);
    const duringRamp = bearing - POINT_VIEW.bearing;
    expect(duringRamp).toBeGreaterThan(0);
    // En arrencar va més lent que la velocitat de creuer.
    expect(duringRamp).toBeLessThan((ORBIT_DEGREES_PER_MS * ORBIT_RAMP_MS) / 4);

    const before = bearing;
    await advance(ORBIT_RAMP_MS);
    const cruising = bearing;
    await advance(10_000);
    // A velocitat de creuer, una volta cada dos minuts.
    expect(bearing - cruising).toBeCloseTo(ORBIT_DEGREES_PER_MS * 10_000, 0);
    expect(cruising).toBeGreaterThan(before);
  });

  it("s'atura si la fitxa deixa de veure's o es vol reduir el moviment", async () => {
    await act(async () => root.render(<PointLocationMapContent {...props} orbit />));
    await act(async () => handlers.load?.());
    await advance(1_000);
    expect(map.setBearing).toHaveBeenCalled();

    await act(async () => root.render(<PointLocationMapContent {...props} orbit={false} />));
    map.setBearing.mockClear();
    await advance(5_000);
    expect(map.setBearing).not.toHaveBeenCalled();
  });
});
