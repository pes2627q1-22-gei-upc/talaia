import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CATALONIA_BORDER, isInCatalonia, isInPolygon } from '../catalunya';

/** `[lat, lon]` de llocs coneguts a tots dos costats de cada frontera. */
const DINS: Record<string, [number, number]> = {
  Barcelona: [41.3874, 2.1686],
  Girona: [41.9794, 2.8214],
  Lleida: [41.6176, 0.62],
  Tarragona: [41.1189, 1.2445],
  Tortosa: [40.8125, 0.5216],
  'Punta de la Banya': [40.57, 0.66],
  Alcanar: [40.5436, 0.4806],
  'Cap de Creus': [42.319, 3.322],
  Portbou: [42.427, 3.159],
  Puigcerdà: [42.4317, 1.9281],
  Llívia: [42.4637, 1.981],
  "La Seu d'Urgell": [42.358, 1.456],
  Vielha: [42.7019, 0.7956],
  Bossòst: [42.787, 0.692],
  'El Pont de Suert': [42.408, 0.741],
  Àger: [42.0294, 0.7112],
  Almacelles: [41.73, 0.44],
  Massalcoreig: [41.4555, 0.3594],
  Batea: [41.094, 0.311],
  Arnes: [40.911, 0.26],
  'La Sénia': [40.633, 0.287],
};

const FORA: Record<string, [number, number]> = {
  Madrid: [40.4168, -3.7038],
  París: [48.8566, 2.3522],
  Palma: [39.5696, 2.6502],
  'Mar, davant de Barcelona': [41.2, 2.6],
  'Andorra la Vella': [42.5063, 1.5218],
  Encamp: [42.535, 1.583],
  Perpinyà: [42.6887, 2.8948],
  Ceret: [42.4856, 2.7481],
  'Prats de Molló': [42.4047, 2.48],
  Benasc: [42.6043, 0.5236],
  Aneto: [42.631, 0.657],
  Saragossa: [41.6488, -0.8891],
  Fraga: [41.5222, 0.3486],
  Mequinensa: [41.3717, 0.3019],
  Maella: [41.122, 0.141],
  Fredes: [40.707, 0.168],
  Vinaròs: [40.4703, 0.4752],
};

describe('isInCatalonia', () => {
  it.each(Object.entries(DINS))('%s és dins', (_nom, [lat, lon]) => {
    expect(isInCatalonia(lat, lon)).toBe(true);
  });

  it.each(Object.entries(FORA))('%s és fora', (_nom, [lat, lon]) => {
    expect(isInCatalonia(lat, lon)).toBe(false);
  });

  it('els 32 punts del catàleg hi són tots', () => {
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

  it('el contorn és dins de la caixa de Catalunya amb el marge', () => {
    for (const [lon, lat] of CATALONIA_BORDER) {
      expect(lon).toBeGreaterThan(0.1);
      expect(lon).toBeLessThan(3.4);
      expect(lat).toBeGreaterThan(40.45);
      expect(lat).toBeLessThan(42.9);
    }
  });
});

describe('isInPolygon', () => {
  const QUADRAT = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ] as const;
  // Una U: la part del mig (de x = 1 a 2, y > 1) queda fora.
  const U = [
    [0, 0],
    [3, 0],
    [3, 3],
    [2, 3],
    [2, 1],
    [1, 1],
    [1, 3],
    [0, 3],
  ] as const;

  it('distingeix dins i fora en un polígon convex', () => {
    expect(isInPolygon(1, 1, QUADRAT)).toBe(true);
    expect(isInPolygon(3, 1, QUADRAT)).toBe(false);
    expect(isInPolygon(1, -1, QUADRAT)).toBe(false);
  });

  it('respecta les entrades d’un polígon còncau, com la d’Andorra', () => {
    expect(isInPolygon(0.5, 2, U)).toBe(true);
    expect(isInPolygon(1.5, 2, U)).toBe(false);
    expect(isInPolygon(1.5, 0.5, U)).toBe(true);
  });
});
