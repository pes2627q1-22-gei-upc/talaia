/** @jest-environment jsdom */
import * as maplibregl from 'maplibre-gl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import ZonePickerMap from '../ZonePickerMap';

jest.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
// MapLibre 6 només s'exporta com a ESM (`import`): Jest no el resol, i aquí sempre és un mock.
jest.mock('maplibre-gl', () => ({ Map: jest.fn() }), { virtual: true });
jest.mock('@/core/map/maplibreWorker', () => ({}));
jest.mock('@/features/map/style/nightStyle', () => ({ ATTRIBUTION: 'ICGC' }));

let root: Root;
let handlers: Record<string, () => void>;
const map = {
  on: jest.fn((event: string, handler: () => void) => {
    handlers[event] = handler;
  }),
  getCenter: jest.fn(() => ({ lat: 42.1, lng: 1.85 })),
  remove: jest.fn(),
  touchZoomRotate: { disableRotation: jest.fn() },
};

beforeEach(() => {
  jest.clearAllMocks();
  handlers = {};
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.mocked(maplibregl.Map).mockImplementation(() => map as unknown as maplibregl.Map);
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => act(() => root.unmount()));

describe('ZonePickerMap', () => {
  it('crea un mapa pla dins de Catalunya i avisa del centre cada cop que s’atura', async () => {
    const onCenterChange = jest.fn(async () => undefined);
    await act(async () =>
      root.render(
        <ZonePickerMap
          mapStyle={{ version: 8, sources: {}, layers: [] }}
          center={{ lat: 41.39, lon: 2.17 }}
          zoom={10}
          maxBounds={[-7, 35, 11, 49]}
          chrome={{ background: '#0E1433', text: '#9AA3C7', link: '#EEF0F7' }}
          accessibilityLabel="Mapa per triar la zona"
          onCenterChange={onCenterChange}
        />,
      ),
    );

    expect(maplibregl.Map).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [2.17, 41.39],
        zoom: 10,
        pitch: 0,
        maxBounds: [
          [-7, 35],
          [11, 49],
        ],
      }),
    );
    expect(map.touchZoomRotate.disableRotation).toHaveBeenCalled();
    expect(document.querySelector('[aria-label="Mapa per triar la zona"]')).not.toBeNull();

    act(() => handlers.moveend?.());
    expect(onCenterChange).toHaveBeenCalledWith({ lat: 42.1, lon: 1.85 });
  });
});
