import { setWorkerUrl } from 'maplibre-gl';
import workerSource from 'maplibre-gl/dist/maplibre-gl-worker.mjs';

// MapLibre 6 carrega el worker d'una URL al costat del seu bundle (`import.meta.url`). Dins d'una DOM
// component no n'hi ha cap: Metro dona el worker com a text (`metro.transformer.js`) i es carrega
// d'un Blob. Només l'importen les DOM components del mapa, abans de crear-lo.
//
// A l'app publicada la pàgina és `file://` i el Blob té origen `null`: MapLibre el veu d'un altre
// origen i el carrega amb un worker de mòdul que importa el Blob, i el WKWebView no ho deixa fer
// («Worker failed to load»). Amb `.cjs` al final de l'URL, MapLibre en fa un worker clàssic, que sí.
export const CLASSIC_WORKER_SUFFIX = '#maplibre-gl-worker.cjs';

setWorkerUrl(
  URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' })) +
    CLASSIC_WORKER_SUFFIX,
);
