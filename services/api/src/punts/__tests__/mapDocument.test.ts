import type { PuntsMapaGeoJson } from '@talaia/shared';

import { buildMapDocument, filterByBbox } from '../mapDocument';

const feature = (id: string, lon: number, lat: number): PuntsMapaGeoJson['features'][number] => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { id, nom: id, municipi: 'm', index: null },
});

const DOC: PuntsMapaGeoJson = {
  type: 'FeatureCollection',
  features: [feature('dins', 1, 41), feature('vora', 2, 42), feature('fora', 3.5, 41)],
};

describe('buildMapDocument', () => {
  it('posa les coordenades en ordre [lon, lat] arrodonides a 6 decimals', () => {
    const doc = buildMapDocument([
      {
        id: 'a',
        nom: 'Cap de Creus',
        municipi: 'Cadaqués',
        lon: 3.3158674321,
        lat: 42.3189126543,
        index: { valor: 50, franja: 'jus' },
      },
    ]);
    expect(doc).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [3.315867, 42.318913] },
          properties: {
            id: 'a',
            nom: 'Cap de Creus',
            municipi: 'Cadaqués',
            index: { valor: 50, franja: 'jus' },
          },
        },
      ],
    });
  });

  it('sense punts retorna una col·lecció buida', () => {
    expect(buildMapDocument([])).toEqual({ type: 'FeatureCollection', features: [] });
  });
});

describe('filterByBbox', () => {
  const ids = (doc: PuntsMapaGeoJson) => doc.features.map((f) => f.properties.id);

  it('inclou els punts que cauen just a la vora del bbox', () => {
    expect(ids(filterByBbox(DOC, { minLon: 1, minLat: 41, maxLon: 2, maxLat: 42 }))).toEqual([
      'dins',
      'vora',
    ]);
  });

  it('un bbox sense cap punt retorna una col·lecció buida', () => {
    expect(filterByBbox(DOC, { minLon: 10, minLat: 10, maxLon: 11, maxLat: 11 })).toEqual({
      type: 'FeatureCollection',
      features: [],
    });
  });

  it('no modifica el document de la memòria cau', () => {
    const abans = structuredClone(DOC);
    filterByBbox(DOC, { minLon: 0, minLat: 0, maxLon: 1, maxLat: 1 });
    expect(DOC).toEqual(abans);
  });
});
