/** @jest-environment node */

// Mòduls de Node amb els tipus mínims: l'app no carrega els de Node.
const { readFileSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: 'utf8') => string;
}>('fs');
const { Script } = jest.requireActual<{ Script: new (code: string) => unknown }>('vm');
const { classicWorker } = jest.requireActual<{ classicWorker: (src: string) => string }>(
  '../../../../metro.transformer.js',
);
const workerPath = (require as unknown as { resolve: (id: string) => string }).resolve(
  'maplibre-gl/dist/maplibre-gl-worker.mjs',
);

it('converteix el worker de MapLibre que porta l’app en un script clàssic', () => {
  const source = readFileSync(workerPath, 'utf8');

  // Tal com ve, és un mòdul: un worker clàssic no el pot executar.
  expect(() => new Script(source)).toThrow(/export/);
  expect(() => new Script(classicWorker(source))).not.toThrow();
  expect(classicWorker(source)).toMatch(/^"use strict";/);
});

it('falla en compilar si MapLibre canvia el format del worker', () => {
  expect(() => classicWorker('export default 1;\nexport const a = 2;')).toThrow(
    /ha canviat de format/,
  );
});
