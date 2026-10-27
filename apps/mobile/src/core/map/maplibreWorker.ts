import { setWorkerUrl } from 'maplibre-gl';
import workerSource from 'maplibre-gl/dist/maplibre-gl-worker.mjs';

// MapLibre 6 carrega el worker d'una URL al costat del seu bundle (`import.meta.url`). Dins d'una DOM
// component no n'hi ha cap: Metro dona el worker com a text (`metro.transformer.js`) i es carrega
// d'un Blob. Només l'importen les DOM components del mapa, abans de crear-lo.
setWorkerUrl(URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' })));
