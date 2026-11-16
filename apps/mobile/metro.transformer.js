/* eslint-disable @typescript-eslint/no-require-imports -- transformador de Metro, en CommonJS */
const upstream = require('@expo/metro-config/babel-transformer');

// MapLibre GL JS 6 carrega el worker d'una URL al costat del seu bundle, que dins d'una DOM component
// no existeix. El worker és un sol fitxer sense imports: l'app el rep com a text i el carrega d'un
// Blob (`src/core/map/maplibreWorker.ts`).
const WORKER = /node_modules[\\/]maplibre-gl[\\/]dist[\\/]maplibre-gl-worker\.mjs$/;
// L'únic `export` del worker és el del final, seguit de la referència al source map.
const EXPORT_AT_END = /export\s*\{[^}]*\};?\s*(\/\/# sourceMappingURL=\S*\s*)?$/;

/**
 * El worker com a script clàssic: a l'app publicada, el WKWebView no carrega el worker de mòdul que
 * hi munta MapLibre (`maplibreWorker.ts`). Sense l'`export` final, i estricte com quan era un mòdul.
 */
function classicWorker(src) {
  if (!EXPORT_AT_END.test(src)) {
    throw new Error('maplibre-gl-worker.mjs ha canviat de format: revisa metro.transformer.js');
  }
  return `"use strict";${src.replace(EXPORT_AT_END, '')}`;
}

module.exports = {
  ...upstream,
  classicWorker,
  transform(args) {
    if (!WORKER.test(args.filename)) return upstream.transform(args);
    const src = classicWorker(args.src);
    return upstream.transform({ ...args, src: `module.exports = ${JSON.stringify(src)};` });
  },
};
/* eslint-enable @typescript-eslint/no-require-imports -- fi del CommonJS */
