import type { LayerSpecification, SourceSpecification, StyleSpecification } from 'maplibre-gl';

import { colors } from '@/core/theme/tokens';

import icgcDark from './icgc-mapa-base-fosc.json';

/**
 * Estil nocturn de Talaia sobre l'estil fosc de l'ICGC (`icgc-mapa-base-fosc.json`, còpia fixa de
 * https://geoserveis.icgc.cat/styles/icgc_mapa_base_fosc.json: l'ICGC el modifica sense versionar-lo).
 * Les tessel·les, les fonts i les icones continuen sortint dels servidors de l'ICGC.
 */

export const ATTRIBUTION =
  '<a href="https://www.icgc.cat/">© Institut Cartogràfic i Geològic de Catalunya</a> (CC BY 4.0) · ' +
  '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · © OpenMapTiles';

export const RELIEF_SOURCE_ID = 'relleu';
export const TERRAIN_SOURCE_ID = 'relleu-3d';

// Model d'elevacions de l'ICGC: 5 m a Catalunya i 30 m al voltant. El de 5 m sol talla en sec a la frontera.
// Fora dels límits el servidor respon 200 amb un cos que no és PNG: cal fixar bounds i zooms.
const reliefSource: SourceSpecification = {
  type: 'raster-dem',
  tiles: [
    'https://tilemaps.icgc.cat/tileserver/tileserver/terreny-5m-30m-rgb-extent/{z}/{x}/{y}.png',
  ],
  encoding: 'mapbox',
  tileSize: 256,
  minzoom: 6,
  maxzoom: 14,
  bounds: [-2, 40, 4, 43.5],
  attribution: ATTRIBUTION,
};

// Ombrejat sobre el terreny 3D: marca les carenes de nit. MapLibre desaconsella que l'ombrejat i el
// terreny comparteixin font, per això n'hi ha dues d'iguals (ADR-0015).
const reliefLayer: LayerSpecification = {
  id: 'talaia-relleu',
  type: 'hillshade',
  source: RELIEF_SOURCE_ID,
  paint: {
    'hillshade-shadow-color': colors.nit,
    'hillshade-highlight-color': colors.crep,
    'hillshade-accent-color': colors.sheet,
    'hillshade-exaggeration': 0.6,
    'hillshade-illumination-direction': 345,
  },
};

// Font pesada (567 kB per tessel·la) que només fa servir una capa de tarteres.
const DROPPED_SOURCES = new Set(['contextmapsadmpt']);
const BUILDINGS_3D = new Set(['building-3d', 'building-industrial-3d']);
const MAJOR_ROAD = /motorway|trunk|primary/;
const BRIGHT_LABEL = /^place-(city|town|country)/;

type Paint = Record<string, unknown>;

function sourceLayer(layer: LayerSpecification): string | undefined {
  return 'source-layer' in layer ? layer['source-layer'] : undefined;
}

/** Colors de nit per a cada capa. Només toca els colors: amplades, opacitats i filtres es queden. */
function nightPaint(layer: LayerSpecification): Paint {
  const group = sourceLayer(layer);
  switch (layer.type) {
    case 'background':
      return { 'background-color': colors.card };
    case 'fill':
      if (group === 'water') return { 'fill-color': colors.nit };
      if (group === 'building')
        return { 'fill-color': colors.crep, 'fill-outline-color': colors.linia };
      if (group === 'aeroway' || group === 'transportation') return { 'fill-color': colors.linia };
      return { 'fill-color': colors.sheet };
    case 'fill-extrusion':
      return { 'fill-extrusion-color': colors.crep };
    case 'line':
      if (group === 'waterway' && !layer.id.startsWith('boundary'))
        return { 'line-color': colors.nit };
      if (group === 'boundary' || layer.id.startsWith('boundary'))
        return { 'line-color': colors.crep };
      if (layer.id.includes('casing')) return { 'line-color': colors.nit };
      return { 'line-color': MAJOR_ROAD.test(layer.id) ? colors.crep : colors.linia };
    case 'symbol':
      return {
        'text-color': BRIGHT_LABEL.test(layer.id) ? colors.lluna : colors.boira,
        'text-halo-color': colors.nit,
      };
    case 'circle':
      return { 'circle-color': colors.lluna, 'circle-stroke-color': colors.nit };
    default:
      return {};
  }
}

function isKept(layer: LayerSpecification): boolean {
  if ('source' in layer && DROPPED_SOURCES.has(layer.source)) return false;
  return layer.layout?.visibility !== 'none' || BUILDINGS_3D.has(layer.id);
}

function toNight(layer: LayerSpecification): LayerSpecification {
  const night = { ...layer, paint: { ...layer.paint, ...nightPaint(layer) } } as LayerSpecification;
  // El fons de l'ICGC té maxzoom 0: no es dibuixa mai.
  if (night.type === 'background') delete night.maxzoom;
  if (night.layout) {
    const layout = { ...night.layout, visibility: 'visible' } as Record<string, unknown>;
    // Les fonts de l'ICGC són fitxers estàtics: una pila de dues fonts dona 404.
    const font = layout['text-font'];
    if (Array.isArray(font) && font.length > 1) layout['text-font'] = [font[0]];
    night.layout = layout as typeof night.layout;
  }
  return night;
}

export function buildNightStyle(base: StyleSpecification): StyleSpecification {
  const layers = base.layers.filter(isKept).map(toNight);
  const reliefAt = layers.findIndex((layer) => sourceLayer(layer) === 'building');
  layers.splice(reliefAt === -1 ? layers.length : reliefAt, 0, reliefLayer);

  const used = new Set(layers.flatMap((layer) => ('source' in layer ? [layer.source] : [])));
  const sources: Record<string, SourceSpecification> = {};
  for (const [id, source] of Object.entries(base.sources)) {
    if (used.has(id)) sources[id] = { ...source, attribution: ATTRIBUTION } as SourceSpecification;
  }
  sources[RELIEF_SOURCE_ID] = reliefSource;
  sources[TERRAIN_SOURCE_ID] = reliefSource;

  return {
    version: 8,
    name: 'Talaia · Nit',
    sprite: base.sprite,
    glyphs: base.glyphs,
    sources,
    layers,
    terrain: { source: TERRAIN_SOURCE_ID, exaggeration: 1.2 },
    // Cel de nit: a l'horitzó, la boira es fon amb el terra i amaga on s'acaben les elevacions.
    sky: {
      'sky-color': colors.nit,
      'horizon-color': colors.crep,
      'fog-color': colors.card,
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.4,
      'atmosphere-blend': 0,
    },
  };
}

/** Estil a punt per al mapa. Constant de mòdul: es passa una vegada a la DOM component. */
export const nightStyle = buildNightStyle(icgcDark as unknown as StyleSpecification);
