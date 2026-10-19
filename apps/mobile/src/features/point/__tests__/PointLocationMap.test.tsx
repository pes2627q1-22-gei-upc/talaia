/** @jest-environment jsdom */
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl from 'maplibre-gl';

import PointLocationMapContent from '../PointLocationMapContent';

jest.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
jest.mock('maplibre-gl', () => ({
  __esModule: true,
  default: { Map: jest.fn(), Marker: jest.fn() },
}));

const props: ComponentProps<typeof PointLocationMapContent> = {
  mapStyle: { version: 8, sources: {}, layers: [] },
  coordinates: { lat: 41.9, lon: 0.8 },
  palette: { background: '#10142c', text: '#fff', link: '#5fd4c4' },
  label: 'Serra del Montsec',
  attributionLabel: 'Crèdits del mapa',
  unavailableLabel: 'Mapa no disponible',
};

let root: Root;
let host: HTMLDivElement;
let mapContainer: HTMLDivElement;
let handlers: Record<string, () => void>;
let map: { getContainer: jest.Mock; on: jest.Mock; areTilesLoaded: jest.Mock; remove: jest.Mock };
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
  };
  marker = { setLngLat: jest.fn().mockReturnThis(), addTo: jest.fn().mockReturnThis() };
  jest.mocked(maplibregl.Map).mockImplementation(() => map as unknown as maplibregl.Map);
  jest.mocked(maplibregl.Marker).mockImplementation(() => marker as unknown as maplibregl.Marker);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it('centra el mapa fix, situa la talaia i permet obrir i tancar els crèdits', async () => {
  await act(async () => root.render(<PointLocationMapContent {...props} />));

  expect(maplibregl.Map).toHaveBeenCalledWith(
    expect.objectContaining({
      center: [0.8, 41.9],
      zoom: 10,
      interactive: false,
      attributionControl: false,
    }),
  );
  expect(marker.setLngLat).toHaveBeenCalledWith([0.8, 41.9]);
  expect(marker.addTo).toHaveBeenCalledWith(map);
  expect(
    jest.mocked(maplibregl.Marker).mock.calls[0]?.[0]?.element?.getAttribute('aria-label'),
  ).toBe(props.label);

  const button = mapContainer.querySelector<HTMLButtonElement>('button');
  const panel = mapContainer.querySelector<HTMLElement>('[role="region"]');
  expect(button?.getAttribute('aria-label')).toBe(props.attributionLabel);
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
