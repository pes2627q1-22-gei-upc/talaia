import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { MARGE_M, distanciaACatalunyaM, isInCatalonia } from '../catalunya';
import { CONTORN_CATALUNYA, TOLERANCIA_CONTORN_M } from '../contornCatalunya';

/**
 * `[lat, lon]` de llocs de Catalunya. Els de la frontera de ponent i de l'Empordà són punts de
 * dins del terme municipal (límits de l'ICGC) que el primer polígon, traçat a mà, deixava fora.
 */
const DINS: Record<string, [number, number]> = {
  // Revisió de la PR: Segrià, Baix Segre, Noguera, Ribera d'Ebre, Terra Alta i Alt Empordà.
  Gimenells: [41.652, 0.389],
  'el Pla de la Font': [41.687, 0.355],
  'Alcarràs, a ponent': [41.6133, 0.382],
  'Almacelles, a ponent': [41.738, 0.4148],
  'Massalcoreig, al nord': [41.4699, 0.3578],
  'Almatret, a ponent': [41.3003, 0.3906],
  'Riba-roja d’Ebre, al nord': [41.2668, 0.4024],
  'Os de Balaguer, a ponent': [41.9403, 0.6173],
  'Batea, a ponent': [41.1256, 0.2065],
  'Maçanet de Cabrenys, al nord': [42.3862, 2.7054],
  // Llívia, l'enclavament: el poble i el nord del terme.
  Llívia: [42.4637, 1.981],
  'Llívia, al nord': [42.4727, 1.9746],
  // La Val d'Aran.
  Vielha: [42.7019, 0.7956],
  Bossòst: [42.787, 0.692],
  'el Pont del Rei': [42.83, 0.7],
  Montgarri: [42.77, 0.995],
  // La costa i el delta de l'Ebre.
  'platja de la Barceloneta': [41.3784, 2.1925],
  'far del Cap de Creus': [42.3189, 3.3158],
  'platja de Portbou': [42.426, 3.162],
  'Meda Gran': [42.047, 3.222],
  Tossa: [41.719, 2.932],
  Sitges: [41.235, 1.811],
  'les Cases d’Alcanar': [40.553, 0.53],
  'Punta de la Banya': [40.57, 0.66],
  'Punta del Fangar': [40.79, 0.75],
  Deltebre: [40.72, 0.71],
  // Capitals.
  Barcelona: [41.3874, 2.1686],
  Girona: [41.9794, 2.8214],
  Lleida: [41.6176, 0.62],
  Tarragona: [41.1189, 1.2445],
};

/** `[lat, lon]` de llocs de fora, tots a més de 2 km de la ratlla. */
const FORA: Record<string, [number, number]> = {
  'Andorra la Vella': [42.5063, 1.5218],
  'Sant Julià de Lòria': [42.464, 1.491],
  Encamp: [42.535, 1.583],
  Ordino: [42.556, 1.533],
  Canillo: [42.567, 1.598],
  Perpinyà: [42.6887, 2.8948],
  Ceret: [42.4856, 2.7481],
  'Prats de Molló': [42.4047, 2.48],
  Sallagosa: [42.457, 2.04],
  'el Voló': [42.525, 2.833],
  Fraga: [41.5222, 0.3486],
  Mequinensa: [41.3717, 0.3019],
  Altorricó: [41.8, 0.41],
  'Tamarit de Llitera': [41.869, 0.426],
  Maella: [41.122, 0.141],
  Calaceit: [41.016, 0.188],
  Benasc: [42.6043, 0.5236],
  Saragossa: [41.6488, -0.8891],
  Fredes: [40.707, 0.168],
  Vinaròs: [40.4703, 0.4752],
  Morella: [40.62, -0.1],
  'mar, davant de Barcelona': [41.2, 2.6],
  'mar, al nord-est del Cap de Creus': [42.3, 3.45],
  Palma: [39.5696, 2.6502],
  Madrid: [40.4168, -3.7038],
  París: [48.8566, 2.3522],
};

describe('isInCatalonia', () => {
  it.each(Object.entries(DINS))('%s és dins', (_nom, [lat, lon]) => {
    expect(isInCatalonia(lat, lon)).toBe(true);
  });

  it.each(Object.entries(FORA))('%s és fora', (_nom, [lat, lon]) => {
    expect(isInCatalonia(lat, lon)).toBe(false);
    expect(distanciaACatalunyaM(lat, lon)).toBeGreaterThan(2_000);
  });

  it('els punts del catàleg hi són tots', () => {
    const cataleg = JSON.parse(
      readFileSync(resolve(__dirname, '../../../../../data/punts_observacio.geojson'), 'utf8'),
    ) as {
      features: { geometry: { coordinates: [number, number] }; properties: { nom: string } }[];
    };
    const fora = cataleg.features
      .filter(
        ({
          geometry: {
            coordinates: [lon, lat],
          },
        }) => !isInCatalonia(lat, lon),
      )
      .map((f) => f.properties.nom);

    expect(cataleg.features.length).toBeGreaterThanOrEqual(32);
    expect(fora).toEqual([]);
  });

  it("a l'altra banda de la ratlla, el marge encara compta com a dins", () => {
    // La Guingueta d'Ix (Bourg-Madame) és a uns 300 m de Puigcerdà, a França.
    expect(distanciaACatalunyaM(42.433, 1.945)).toBeGreaterThan(0);
    expect(distanciaACatalunyaM(42.433, 1.945)).toBeLessThan(MARGE_M);
    expect(isInCatalonia(42.433, 1.945)).toBe(true);
  });

  it('el marge cobreix la simplificació del contorn', () => {
    expect(MARGE_M).toBeGreaterThan(TOLERANCIA_CONTORN_M);
  });
});

describe('contornCatalunya (generat)', () => {
  it('és un MultiPolygon tancat amb el contorn de Catalunya i Llívia', () => {
    expect(CONTORN_CATALUNYA.length).toBeGreaterThanOrEqual(2);
    for (const poligon of CONTORN_CATALUNYA) {
      for (const anell of poligon) {
        expect(anell.length).toBeGreaterThanOrEqual(4);
        expect(anell[0]).toEqual(anell[anell.length - 1]);
      }
    }
    // El primer és el gran; Llívia, un altre polígon.
    const llivia = CONTORN_CATALUNYA.slice(1).some(([exterior]) =>
      exterior?.some(([lon, lat]) => Math.abs(lon - 1.98) < 0.05 && Math.abs(lat - 42.46) < 0.05),
    );
    expect(llivia).toBe(true);
  });

  it('totes les coordenades són de Catalunya, en [lon, lat]', () => {
    for (const [lon, lat] of CONTORN_CATALUNYA.flat(2)) {
      expect(lon).toBeGreaterThan(0.1);
      expect(lon).toBeLessThan(3.4);
      expect(lat).toBeGreaterThan(40.5);
      expect(lat).toBeLessThan(42.9);
    }
  });
});
