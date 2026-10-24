/** @jest-environment node */
import { setWorkerUrl } from 'maplibre-gl';

// MapLibre 6 només s'exporta com a ESM (`import`): Jest no el resol, i aquí sempre és un mock.
jest.mock('maplibre-gl', () => ({ setWorkerUrl: jest.fn() }), { virtual: true });
// A l'app, `metro.transformer.js` converteix el worker en aquest text.
jest.mock(
  'maplibre-gl/dist/maplibre-gl-worker.mjs',
  () => ({ __esModule: true, default: 'export{};' }),
  { virtual: true },
);

it('registra el worker de MapLibre des d’un Blob de JavaScript', async () => {
  const createObjectURL = jest.fn((_blob: Blob) => 'blob:talaia/worker');
  URL.createObjectURL = createObjectURL;

  jest.isolateModules(() => {
    jest.requireActual('../maplibreWorker');
  });

  expect(setWorkerUrl).toHaveBeenCalledWith('blob:talaia/worker');
  const blob = createObjectURL.mock.calls[0]?.[0];
  expect(blob?.type).toBe('text/javascript');
  await expect(blob?.text()).resolves.toBe('export{};');
});
