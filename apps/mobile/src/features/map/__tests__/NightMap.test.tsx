/** @jest-environment jsdom */
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl from 'maplibre-gl';

import NightMap from '../NightMap';
import { bindClusterInteraction, syncMapPoints } from '../pointMarkers';

jest.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
jest.mock('maplibre-gl', () => ({
  __esModule: true,
  default: { Map: jest.fn(), Marker: jest.fn() },
}));
jest.mock('../pointMarkers', () => ({
  bindClusterInteraction: jest.fn(),
  syncMapPoints: jest.fn(),
}));

const props: ComponentProps<typeof NightMap> = {
  mapStyle: { version: 8, sources: {}, layers: [] },
  camera: {
    center: [2, 41],
    zoom: 7,
    pitch: 50,
    minZoom: 6,
    maxZoom: 17,
    maxBounds: [0, 40, 4, 43],
  },
  chrome: { background: '#000', text: '#aaa', link: '#fff' },
  accessibilityLabel: 'Mapa nocturn',
  userLocation: null,
  userHeading: null,
  locationActive: false,
  userLocationLabel: 'La teva ubicació',
  userLocationColor: '#4B9FFF',
  points: { type: 'FeatureCollection', features: [] },
  markerPalette: {
    background: '#000',
    clusterBackground: '#111',
    clusterBorder: '#222',
    text: '#fff',
    unknown: '#aaa',
    ras: '#0f0',
    jus: '#ff0',
    tap: '#f00',
  },
};

let root: Root;
let host: HTMLDivElement;
let load: () => void;
let map: { on: jest.Mock; remove: jest.Mock };
let unbind: jest.Mock;
let markers: {
  element: HTMLElement;
  setLngLat: jest.Mock;
  addTo: jest.Mock;
  remove: jest.Mock;
  setRotation: jest.Mock;
  getElement(): HTMLElement;
}[];

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  unbind = jest.fn();
  jest.mocked(bindClusterInteraction).mockReturnValue(unbind);
  map = {
    on: jest.fn((event, callback) => {
      if (event === 'load') load = callback;
    }),
    remove: jest.fn(),
  };
  jest.mocked(maplibregl.Map).mockImplementation(() => map as unknown as maplibregl.Map);
  markers = [];
  jest.mocked(maplibregl.Marker).mockImplementation((options) => {
    const marker = {
      element: options!.element!,
      setLngLat: jest.fn().mockReturnThis(),
      addTo: jest.fn().mockReturnThis(),
      remove: jest.fn(),
      setRotation: jest.fn(),
      getElement() {
        return this.element;
      },
    };
    markers.push(marker);
    return marker as unknown as maplibregl.Marker;
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it('espera l’estil, utilitza les últimes dades i conserva el mapa en actualitzar punts', async () => {
  await act(async () => root.render(<NightMap {...props} />));
  expect(host.querySelector('[role="region"]')?.getAttribute('aria-label')).toBe('Mapa nocturn');
  expect(syncMapPoints).not.toHaveBeenCalled();
  const points: typeof props.points = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [2, 41] },
        properties: { id: 'test', nom: 'Lloc', municipi: '', index: null },
      },
    ],
  };
  await act(async () => root.render(<NightMap {...props} points={points} />));
  await act(async () => load());
  expect(syncMapPoints).toHaveBeenLastCalledWith(map, points, props.markerPalette);
  await act(async () => root.render(<NightMap {...props} />));
  expect(syncMapPoints).toHaveBeenLastCalledWith(map, props.points, props.markerPalette);
  expect(maplibregl.Map).toHaveBeenCalledTimes(1);
  expect(maplibregl.Marker).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  expect(unbind).toHaveBeenCalledTimes(1);
  expect(map.remove).toHaveBeenCalledTimes(1);
});

it('mostra ubicació i direcció, amaga la fletxa inactiva i retira els marcadors sense ubicació', async () => {
  const located = {
    ...props,
    userLocation: { lat: 41, lon: 2 },
    userHeading: 45,
    locationActive: true,
  };
  await act(async () => root.render(<NightMap {...located} />));
  const [dot, arrow] = markers;
  expect(dot!.setLngLat).toHaveBeenCalledWith([2, 41]);
  expect(dot!.addTo).toHaveBeenCalledWith(map);
  expect(dot!.element.getAttribute('aria-label')).toBe(props.userLocationLabel);
  expect(dot!.element.querySelector('.talaia-location-pulse')).not.toBeNull();
  expect(arrow!.setRotation).toHaveBeenLastCalledWith(45);
  expect(arrow!.element.style.visibility).toBe('visible');
  await act(async () => root.render(<NightMap {...located} locationActive={false} />));
  expect(arrow!.element.style.visibility).toBe('hidden');
  await act(async () => root.render(<NightMap {...located} userHeading={null} />));
  expect(arrow!.element.style.visibility).toBe('hidden');
  await act(async () => root.render(<NightMap {...located} userHeading={90} />));
  expect(arrow!.setRotation).toHaveBeenLastCalledWith(90);
  expect(markers).toHaveLength(2);
  await act(async () => root.render(<NightMap {...located} userLocation={{ lat: 42, lon: 3 }} />));
  expect(markers).toHaveLength(2);
  expect(dot!.setLngLat).toHaveBeenLastCalledWith([3, 42]);
  expect(arrow!.setLngLat).toHaveBeenLastCalledWith([3, 42]);
  expect(dot!.remove).not.toHaveBeenCalled();
  expect(arrow!.remove).not.toHaveBeenCalled();
  await act(async () => root.render(<NightMap {...props} />));
  expect(dot!.remove).toHaveBeenCalledTimes(1);
  expect(arrow!.remove).toHaveBeenCalledTimes(1);
});

it.each([
  { lat: NaN, lon: 2 },
  { lat: 41, lon: Infinity },
])('no crea marcadors amb coordenades invàlides (%s)', async (userLocation) => {
  await act(async () => root.render(<NightMap {...props} userLocation={userLocation} />));
  expect(maplibregl.Marker).not.toHaveBeenCalled();
});
