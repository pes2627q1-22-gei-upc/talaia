import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type { Map } from 'maplibre-gl';

import { colors } from '@/core/theme/tokens';

import {
  EMPTY_MAP_POINTS,
  markerData,
  markerLayers,
  type MapPoints,
  POINTS_SOURCE,
  syncMapPoints,
} from '../pointMarkers';

const palette = {
  background: colors.nit,
  clusterBackground: colors.crep,
  clusterBorder: colors.vora,
  text: colors.lluna,
  unknown: colors.boira,
  ras: colors.ras,
  jus: colors.jus,
  tap: colors.tap,
};

function points(index: MapPoints['features'][number]['properties']['index']): MapPoints {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0.75, 42.05] },
        properties: { id: 'montsec', nom: 'Serra del Montsec', municipi: 'Àger', index },
      },
    ],
  };
}

describe('marcadors del mapa', () => {
  it.each([
    undefined,
    null,
    { valor: NaN, franja: 'ras' as const },
    { valor: 0, franja: 'tap' as const, deDia: true },
  ])('mostra un guió neutre quan falta un índex vàlid (%s)', (index) => {
    expect(markerData(points(index)).features[0]?.properties).toMatchObject({
      label: '—',
      band: 'unknown',
    });
  });

  it.each([
    { valor: 0, franja: 'tap' as const },
    { valor: 63, franja: 'jus' as const },
    { valor: 100, franja: 'ras' as const },
  ])('conserva el valor i la franja de l’API (%s)', (index) => {
    const feature = markerData(points(index)).features[0];
    expect(feature?.properties).toMatchObject({ label: String(index.valor), band: index.franja });
    expect(feature?.geometry.coordinates).toEqual([0.75, 42.05]);
  });

  it.each([true, false])(
    'genera capes vàlides segons l’especificació de MapLibre (grups: %s)',
    (cluster) => {
      expect(
        validateStyleMin({
          version: 8,
          glyphs: 'https://example.org/{fontstack}/{range}.pbf',
          sources: { [POINTS_SOURCE]: { type: 'geojson', data: EMPTY_MAP_POINTS } },
          layers: markerLayers(palette, cluster),
        }),
      ).toEqual([]);
    },
  );

  it('al rànquing els marcadors no es trepitgen i el de més índex té prioritat', () => {
    const markers = markerLayers(palette, false).find(
      (layer) => layer.id === 'talaia-point-markers',
    );
    expect(markers?.layout).toMatchObject({
      'icon-allow-overlap': false,
      'text-allow-overlap': false,
      'symbol-sort-key': ['-', 0, ['get', 'rank']],
    });
  });

  it('actualitza la font existent sense tornar a crear capes ni moure la càmera', () => {
    const setData = jest.fn();
    const map = { getSource: jest.fn(() => ({ setData })) };
    const data = points({ valor: 87, franja: 'ras' });
    syncMapPoints(map as unknown as Map, data, palette);
    expect(map.getSource).toHaveBeenCalledWith(POINTS_SOURCE);
    expect(setData).toHaveBeenCalledWith(markerData(data));
  });

  it('no recalcula els clústers quan el pont envia còpies de les mateixes dades', () => {
    const source = { setData: jest.fn() };
    const map = { getSource: jest.fn(() => source) };
    syncMapPoints(map as unknown as Map, points({ valor: 87, franja: 'ras' }), palette);
    syncMapPoints(map as unknown as Map, points({ valor: 87, franja: 'ras' }), { ...palette });
    expect(source.setData).toHaveBeenCalledTimes(1);

    syncMapPoints(map as unknown as Map, points({ valor: 63, franja: 'jus' }), palette);
    expect(source.setData).toHaveBeenCalledTimes(2);
    expect(source.setData).toHaveBeenLastCalledWith(
      markerData(points({ valor: 63, franja: 'jus' })),
    );
  });
});
