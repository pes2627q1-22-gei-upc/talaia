import type { IndexVisibilitat, PuntMapaFeature } from '@talaia/shared';
import type { FeatureCollection, Point } from 'geojson';
import type { GeoJSONSource, LayerSpecification, Map, MapLayerMouseEvent } from 'maplibre-gl';

/** El mapa també pot representar un punt abans que el worker n'hagi calculat l'índex. */
export type MapPoints = {
  type: 'FeatureCollection';
  features: (Omit<PuntMapaFeature, 'properties'> & {
    properties: Omit<PuntMapaFeature['properties'], 'index'> & {
      index?: IndexVisibilitat | null;
    };
  })[];
};

export type MarkerPalette = {
  background: string;
  clusterBackground: string;
  clusterBorder: string;
  text: string;
  unknown: string;
  ras: string;
  jus: string;
  tap: string;
};

export const EMPTY_MAP_POINTS: MapPoints = { type: 'FeatureCollection', features: [] };
export const POINTS_SOURCE = 'talaia-points';
export const CLUSTERS_LAYER = 'talaia-point-clusters';
export const CLUSTER_OPTIONS = { cluster: true, clusterRadius: 55, clusterMaxZoom: 14 };
export const MARKERS_LAYER = 'talaia-point-markers';
const NAMES_LAYER = 'talaia-point-names';
const PIN_WIDTH = 44;
const PIN_HEIGHT = 60;
const PIN_CENTER = 22;
const PIN_RADIUS = 17;
const PIN_FOOT = 55;
const INDEX_SIZE = 18;
const CLUSTER_IMAGE = 'talaia-cluster-disc';
// El pont DOM pot enviar una còpia nova del mateix GeoJSON a cada render natiu.
const sourceData = new WeakMap<GeoJSONSource, string>();

function drawClusterDisc(palette: MarkerPalette, pixelRatio: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 46 * pixelRatio;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.scale(pixelRatio, pixelRatio);
  ctx.beginPath();
  ctx.arc(23, 23, 22, 0, Math.PI * 2);
  ctx.fillStyle = palette.clusterBackground;
  ctx.fill();
  ctx.strokeStyle = palette.clusterBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Propietats planes per al worker de MapLibre; l'índex absent no es converteix en zero. */
export function markerData(points: MapPoints): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: points.features.map(({ geometry, properties }) => {
      const index = properties.index;
      const hasIndex =
        index != null &&
        Number.isInteger(index.valor) &&
        index.valor >= 0 &&
        index.valor <= 100 &&
        ['ras', 'jus', 'tap'].includes(index.franja);
      return {
        type: 'Feature',
        id: properties.id,
        geometry,
        properties: {
          id: properties.id,
          nom: properties.nom,
          label: hasIndex ? String(index.valor) : '—',
          band: hasIndex ? index.franja : 'unknown',
        },
      };
    }),
  };
}

/** Anell, tija i peu del mockup. Es rasteritza segons la densitat de la pantalla. */
export function drawMarkerPin(color: string, background: string, pixelRatio = 2): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = PIN_WIDTH * pixelRatio;
  canvas.height = PIN_HEIGHT * pixelRatio;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.scale(pixelRatio, pixelRatio);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PIN_CENTER, PIN_CENTER + PIN_RADIUS);
  ctx.lineTo(PIN_CENTER, PIN_FOOT);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(PIN_CENTER, PIN_FOOT, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(PIN_CENTER, PIN_CENTER, PIN_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = background;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function markerLayers(palette: MarkerPalette): LayerSpecification[] {
  return [
    {
      id: CLUSTERS_LAYER,
      type: 'symbol',
      source: POINTS_SOURCE,
      filter: ['has', 'point_count'],
      layout: {
        // Icona i text comparteixen el cicle de col·locació i desaparició del símbol.
        'icon-image': CLUSTER_IMAGE,
        'icon-size': ['step', ['get', 'point_count'], 1, 100, 28 / 22, 1000, 34 / 22],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-pitch-alignment': 'viewport',
        'icon-rotation-alignment': 'viewport',
        'text-field': ['to-string', ['get', 'point_count']],
        'text-font': ['FiraSans-Bold'],
        'text-size': 16,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-pitch-alignment': 'viewport',
        'text-rotation-alignment': 'viewport',
      },
      paint: { 'text-color': palette.text },
    },
    {
      id: MARKERS_LAYER,
      type: 'symbol',
      source: POINTS_SOURCE,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': ['concat', 'talaia-pin-', ['get', 'band']],
        'icon-anchor': 'bottom',
        'icon-offset': [0, PIN_HEIGHT - PIN_FOOT],
        'icon-pitch-alignment': 'viewport',
        'icon-rotation-alignment': 'viewport',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-field': ['get', 'label'],
        // Font disponible als glyphs de l'ICGC que ja fa servir el mapa.
        'text-font': ['FiraSans-Bold'],
        'text-size': INDEX_SIZE,
        'text-offset': [0, (PIN_CENTER - PIN_FOOT) / INDEX_SIZE],
        'text-pitch-alignment': 'viewport',
        'text-rotation-alignment': 'viewport',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': [
          'match',
          ['get', 'band'],
          'ras',
          palette.ras,
          'jus',
          palette.jus,
          'tap',
          palette.tap,
          palette.unknown,
        ],
      },
    },
    {
      id: NAMES_LAYER,
      type: 'symbol',
      source: POINTS_SOURCE,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['get', 'nom'],
        'text-font': ['FiraSans-Bold'],
        'text-size': 11,
        'text-anchor': 'left',
        'text-offset': [2.2, -1.3],
        'text-max-width': 12,
        'text-pitch-alignment': 'viewport',
        'text-rotation-alignment': 'viewport',
      },
      paint: {
        'text-color': palette.text,
        'text-halo-color': palette.background,
        'text-halo-width': 1.5,
      },
    },
  ];
}

/**
 * Actualitza la font existent: les dades noves no recreen el mapa ni mouen la càmera. `cluster` només
 * compta en crear la font: amb un rànquing, els grups amagarien els millors punts.
 */
export function syncMapPoints(map: Map, points: MapPoints, palette: MarkerPalette, cluster = true) {
  const data = markerData(points);
  const serialized = JSON.stringify(data);
  const source = map.getSource(POINTS_SOURCE) as GeoJSONSource | undefined;
  if (source) {
    if (sourceData.get(source) === serialized) return;
    source.setData(data);
    sourceData.set(source, serialized);
    return;
  }
  const pixelRatio = Math.max(1, Math.ceil(globalThis.devicePixelRatio || 1));
  if (!map.hasImage(CLUSTER_IMAGE)) {
    map.addImage(CLUSTER_IMAGE, drawClusterDisc(palette, pixelRatio), { pixelRatio });
  }
  for (const band of ['ras', 'jus', 'tap', 'unknown'] as const) {
    const id = `talaia-pin-${band}`;
    if (!map.hasImage(id)) {
      map.addImage(id, drawMarkerPin(palette[band], palette.background, pixelRatio), {
        pixelRatio,
      });
    }
  }
  map.addSource(POINTS_SOURCE, { type: 'geojson', data, ...(cluster ? CLUSTER_OPTIONS : {}) });
  const createdSource = map.getSource(POINTS_SOURCE) as GeoJSONSource | undefined;
  if (createdSource) sourceData.set(createdSource, serialized);
  for (const layer of markerLayers(palette)) map.addLayer(layer);
}

/** Cada toc amplia fins a la següent divisió del grup, que pot contenir altres grups. */
export function bindClusterInteraction(map: Map): () => void {
  let active = true;
  let request = 0;
  const click = async (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    const clusterId = feature?.properties?.cluster_id;
    if (feature?.geometry.type !== 'Point' || typeof clusterId !== 'number') return;
    const [lon, lat] = feature.geometry.coordinates;
    if (lon === undefined || lat === undefined) return;
    const source = map.getSource(POINTS_SOURCE) as GeoJSONSource | undefined;
    if (!source) return;
    const currentRequest = ++request;
    try {
      const zoom = await source.getClusterExpansionZoom(clusterId);
      if (!active || currentRequest !== request || map.getSource(POINTS_SOURCE) !== source) return;
      // No acabar just al llindar de tessel·la: amb inclinació i relleu encara es pot
      // veure el nivell anterior. Un grup visible ha de permetre continuar apropant.
      const targetZoom = Math.min(Math.max(zoom + 0.5, map.getZoom() + 1), map.getMaxZoom());
      map.easeTo({ center: [lon, lat], zoom: targetZoom });
    } catch {
      // El worker pot haver substituït el grup mentre es renovaven els punts.
      // L'usuari pot tornar a tocar el grup actual sense interrompre el mapa.
    }
  };
  const enter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const leave = () => {
    map.getCanvas().style.cursor = '';
  };
  const invalidate = (event: { sourceId?: string }) => {
    if (event.sourceId === POINTS_SOURCE) request++;
  };
  map.on('click', CLUSTERS_LAYER, click);
  map.on('mouseenter', CLUSTERS_LAYER, enter);
  map.on('mouseleave', CLUSTERS_LAYER, leave);
  map.on('sourcedataloading', invalidate);
  return () => {
    active = false;
    map.off('click', CLUSTERS_LAYER, click);
    map.off('mouseenter', CLUSTERS_LAYER, enter);
    map.off('mouseleave', CLUSTERS_LAYER, leave);
    map.off('sourcedataloading', invalidate);
    leave();
  };
}
