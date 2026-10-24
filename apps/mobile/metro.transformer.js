/* eslint-disable @typescript-eslint/no-require-imports -- transformador de Metro, en CommonJS */
const upstream = require('@expo/metro-config/babel-transformer');

// MapLibre GL JS 6 carrega el worker d'una URL al costat del seu bundle, que dins d'una DOM component
// no existeix. El worker és un sol fitxer sense imports: l'app el rep com a text i el carrega d'un
// Blob (`src/core/map/maplibreWorker.ts`).
const WORKER = /node_modules[\\/]maplibre-gl[\\/]dist[\\/]maplibre-gl-worker\.mjs$/;

module.exports = {
  ...upstream,
  transform(args) {
    if (!WORKER.test(args.filename)) return upstream.transform(args);
    return upstream.transform({ ...args, src: `module.exports = ${JSON.stringify(args.src)};` });
  },
};
/* eslint-enable @typescript-eslint/no-require-imports -- fi del CommonJS */
