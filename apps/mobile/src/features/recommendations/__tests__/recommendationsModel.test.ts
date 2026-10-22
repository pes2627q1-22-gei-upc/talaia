import type { Recomanacio } from '@talaia/shared';

import { localTime, ordinal, parseQuery, toMapPoints } from '../recommendationsModel';

const PARAMS = {
  objectiu: 'via_lactia',
  lat: '41.387',
  lon: '2.169',
  data: '2026-10-22',
  desDe: '22',
  finsA: '6',
  tempsMaxim: '90',
  lloc: 'Barcelona',
};

describe('parseQuery', () => {
  it('converteix els paràmetres de «Què vols veure?» en una consulta', () => {
    expect(parseQuery(PARAMS)).toEqual({
      objectiu: 'via_lactia',
      origen: { lat: 41.387, lon: 2.169 },
      data: '2026-10-22',
      desDe: 22,
      finsA: 6,
      tempsMaxim: 90,
    });
  });

  it('sense cerca («Veure el mapa») o amb un paràmetre que falta o no és vàlid, no hi ha consulta', () => {
    expect(parseQuery({})).toBeNull();
    expect(parseQuery({ ...PARAMS, objectiu: 'lluna' })).toBeNull();
    expect(parseQuery({ ...PARAMS, data: '22/10/2026' })).toBeNull();
    expect(parseQuery({ ...PARAMS, lat: '' })).toBeNull();
    expect(parseQuery({ ...PARAMS, tempsMaxim: 'molt' })).toBeNull();
    const { finsA: _, ...senseFinsA } = PARAMS;
    expect(parseQuery(senseFinsA)).toBeNull();
  });
});

describe('toMapPoints', () => {
  it('el marcador porta l’índex de la millor hora, o cap si no en té', () => {
    const punt = (id: string, valor: number | null): Recomanacio => ({
      id,
      nom: id,
      municipi: 'Àger',
      lat: 42.05,
      lon: 0.75,
      distanciaKm: 120,
      tempsEstimat: 100,
      millorHora:
        valor === null
          ? null
          : {
              hora: '2026-10-22T00:00:00Z',
              valor,
              franja: 'ras',
              factors: { nuvols: 1, sol: 1, foscor: 1, lluna: 1 },
              foscorEstimada: false,
            },
      mitjana: valor,
      horesAmbIndex: valor === null ? 0 : 6,
    });
    expect(toMapPoints([punt('montsec', 87), punt('cadi', null)])).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0.75, 42.05] },
          properties: {
            id: 'montsec',
            nom: 'montsec',
            municipi: 'Àger',
            index: { valor: 87, franja: 'ras' },
          },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0.75, 42.05] },
          properties: { id: 'cadi', nom: 'cadi', municipi: 'Àger', index: null },
        },
      ],
    });
  });
});

it('localTime dona l’hora local amb els minuts', () => {
  expect(localTime(new Date(2026, 9, 23, 2, 0).toISOString())).toBe('02:00');
  expect(localTime(new Date(2026, 9, 22, 21, 30).toISOString())).toBe('21:30');
});

it.each([
  ['ca', [1, 2, 3, 4, 5, 11], ['1r', '2n', '3r', '4t', '5è', '11è']],
  ['es', [1, 2, 10], ['1.º', '2.º', '10.º']],
  [
    'en',
    [1, 2, 3, 4, 11, 12, 13, 21, 22, 23],
    ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd'],
  ],
])('ordinal en %s', (language, positions, expected) => {
  expect(positions.map((position) => ordinal(position, language))).toEqual(expected);
});
