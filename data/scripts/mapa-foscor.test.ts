/**
 * Tests del mapa de foscor (TG-97). `node --test` de Node 22, sense xarxa: les cel·les són una
 * mostra real de la capa de la Generalitat (descàrrega del 16/10/2026) al voltant del Montsec,
 * Barcelona, el Mont Caro i la platja del Trabucador.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FONT_SQM,
  SENSE_DADA,
  aGeoTiff,
  descarregaCeles,
  llegirMalla,
  parsejaCeles,
  rang,
  rasteritza,
  sqmA,
  sqmProper,
  utm31,
  type CelaSqm,
} from './mapa-foscor.ts';

/** [ID, MAG, x mínima, y mínima] de cel·les reals (EPSG:25831, costat 1000 m). */
const CELES_FONT: [number, number, number, number][] = [
  [20701, 21.62729952, 308660.2119, 4654475.5027],
  [21121, 21.64541283, 308660.1946, 4656475.5451],
  [21125, 21.64924011, 309660.2041, 4656475.5419],
  [21131, 21.64708786, 310660.2023, 4656475.5688],
  [20706, 21.57849235, 309660.1722, 4654475.5176],
  [20711, 21.61060042, 310660.204, 4654475.5604],
  [20911, 21.63360736, 308660.1541, 4655475.4688],
  [20915, 21.65601189, 309660.222, 4655475.4724], // conté el Montsec (0,7112 E, 42,0294 N)
  [20921, 21.6331394, 310660.1955, 4655475.5083],
  [20491, 21.65393804, 308660.1991, 4653475.5403],
  [20496, 21.55691885, 309660.2176, 4653475.5621],
  [20501, 21.60347121, 310660.2217, 4653475.5029],
  [6856, 18.48224097, 430660.215, 4581475.4867], // Barcelona
  [1080, 21.5295412, 275660.18, 4519475.4772], // Mont Caro
  [68, 21.45013603, 304660.1939, 4494475.4791], // platja del Trabucador
];

function feature([id, mag, x, y]: (typeof CELES_FONT)[number], mida = 1000) {
  const anell = [
    [x, y + mida],
    [x, y],
    [x + mida, y],
    [x + mida, y + mida],
    [x, y + mida],
  ];
  return {
    type: 'Feature',
    geometry: { type: 'MultiPolygon', coordinates: [[anell]] },
    properties: { ID: id, MAG: mag, RANGS_MAG: '' },
  };
}

const geojson = (features: unknown[]) => ({ type: 'FeatureCollection', features });

const CELES = parsejaCeles(geojson(CELES_FONT.map((c) => feature(c))));
const MALLA = rasteritza(CELES);

const MONTSEC = { lat: 42.0294, lon: 0.7112 };
const BARCELONA = { lat: 41.3851, lon: 2.1734 };

describe('utm31', () => {
  /** Referència: gdaltransform -s_srs EPSG:4326 -t_srs EPSG:25831 (PROJ). */
  const casos: [string, number, number, number, number][] = [
    ['Barcelona', 41.3851, 2.1734, 430887.564, 4581837.853],
    ['Montsec', 42.0294, 0.7112, 310528.998, 4655574.901],
    ['Cap de Creus', 42.318913, 3.315867, 526028.342, 4685234.061],
    ['Mont Caro', 40.80313, 0.34311, 275876.065, 4520300.016],
    ['Port de la Bonaigua', 42.664089, 0.978152, 334304.765, 4725495.246],
    ['platja del Trabucador', 40.580332, 0.701111, 305430.688, 4494711.567],
  ];
  for (const [nom, lat, lon, x, y] of casos) {
    it(`coincideix amb PROJ a ${nom} (± 1 cm)`, () => {
      const p = utm31(lat, lon);
      assert.ok(Math.abs(p.x - x) < 0.01, `x: ${p.x} ≠ ${x}`);
      assert.ok(Math.abs(p.y - y) < 0.01, `y: ${p.y} ≠ ${y}`);
    });
  }

  it('rebutja punts fora del fus 31', () => {
    assert.throws(() => utm31(40, -3.5), RangeError);
    assert.throws(() => utm31(40, 9.5), RangeError);
    assert.throws(() => utm31(NaN, 2), RangeError);
  });
});

describe('parsejaCeles', () => {
  it('treu el centre i el MAG de cada cel·la', () => {
    const [cela] = parsejaCeles(geojson([feature(CELES_FONT[7]!)]));
    assert.deepEqual(cela, { x: 310160.222, y: 4655975.4724, sqm: 21.65601189 });
  });

  it('accepta polígons simples i omet les cel·les sense valor', () => {
    const simple = feature(CELES_FONT[0]!);
    simple.geometry = { type: 'MultiPolygon', coordinates: simple.geometry.coordinates };
    const poligon = {
      ...simple,
      geometry: { type: 'Polygon', coordinates: simple.geometry.coordinates[0] },
    };
    const senseValor = { ...feature(CELES_FONT[1]!), properties: { ID: 1, MAG: null } };
    assert.equal(parsejaCeles(geojson([poligon, senseValor])).length, 1);
  });

  it('rebutja cel·les que no fan 1 km, valors impossibles i respostes que no són GeoJSON', () => {
    assert.throws(() => parsejaCeles(geojson([feature(CELES_FONT[0]!, 500)])), /500 × 500 m/);
    const impossible = { ...feature(CELES_FONT[0]!), properties: { ID: 9, MAG: 42 } };
    assert.throws(() => parsejaCeles(geojson([impossible])), /no és un SQM/);
    assert.throws(() => parsejaCeles({ type: 'Feature' }), TypeError);
  });
});

describe('rasteritza', () => {
  it("alinea l'origen a la cel·la més al nord-oest, arrodonit al metre", () => {
    assert.equal(MALLA.x0, 275660);
    assert.equal(MALLA.y0, 4657476);
    assert.equal(MALLA.costat, FONT_SQM.costat);
    assert.equal(MALLA.columnes, 156); // de 275660 a 431660, tot i la deriva de 21 cm de la font
    assert.equal(MALLA.files, 163);
    assert.equal(MALLA.valors.length, 156 * 163);
    const plenes = MALLA.valors.filter((v) => v !== SENSE_DADA).length;
    assert.equal(plenes, CELES_FONT.length);
  });

  it('rebutja dues cel·les al mateix lloc o cap cel·la', () => {
    const repetides: CelaSqm[] = [CELES[0]!, { ...CELES[0]!, x: CELES[0]!.x + 0.5 }];
    assert.throws(() => rasteritza(repetides), /mateixa posició/);
    assert.throws(() => rasteritza([]), RangeError);
  });
});

describe('sqmA', () => {
  it('dona el MAG de la cel·la que conté el punt, el mateix que el GetFeatureInfo del WMS', () => {
    assert.ok(Math.abs(sqmA(MALLA, MONTSEC.lat, MONTSEC.lon)! - 21.65601189) < 1e-5);
    assert.ok(Math.abs(sqmA(MALLA, BARCELONA.lat, BARCELONA.lon)! - 18.48224097) < 1e-5);
  });

  it('és null fora de la malla o en un forat', () => {
    assert.equal(sqmA(MALLA, 42.318913, 3.315867), null); // Cap de Creus: fora de la malla de prova
    assert.equal(sqmA(MALLA, 41.9, 1.5), null); // dins de la malla, sense cel·la
  });
});

describe('sqmProper', () => {
  it('torna la cel·la mateixa amb distància 0 quan el punt hi cau dins', () => {
    assert.deepEqual(sqmProper(MALLA, MONTSEC.lat, MONTSEC.lon)?.distancia, 0);
  });

  it('en un forat, torna la cel·la més propera i la distància al seu centre', () => {
    // Just a l'est de la columna més oriental del bloc del Montsec: la cel·la 20921 és la més propera.
    const proper = sqmProper(MALLA, 42.0294, 0.7355);
    assert.ok(proper);
    assert.ok(Math.abs(proper.sqm - 21.6331394) < 1e-5);
    assert.ok(proper.distancia > 500 && proper.distancia < 1500, String(proper.distancia));
    assert.equal(sqmProper(MALLA, 42.0294, 0.7355, 0), null);
  });

  it('és null si no hi ha cap cel·la dins del radi', () => {
    assert.equal(sqmProper(MALLA, 41.9, 1.5), null);
  });

  it('el radi és una distància, no una finestra quadrada: en diagonal també talla a 2 km', () => {
    // Una sola cel·la, la de Barcelona. 1,8 km al nord del punt queda a 1,7 km del centre; 1,8 km
    // al nord i a l'est és dins de la finestra de ±2 cel·les però a 2,3 km del centre.
    const sola = rasteritza(parsejaCeles(geojson([feature(CELES_FONT[12]!)])));
    const nord = sqmProper(sola, BARCELONA.lat + 0.0162, BARCELONA.lon);
    assert.ok(nord && nord.distancia > 1600 && nord.distancia < 1800, String(nord?.distancia));
    assert.equal(sqmProper(sola, BARCELONA.lat + 0.0162, BARCELONA.lon + 0.0216), null);
  });
});

describe('rang', () => {
  it('troba el mínim i el màxim sense desbordar la pila', () => {
    assert.deepEqual(rang([3, -1, 7, 2]), { min: -1, max: 7 });
    const molts = new Float32Array(500_000).map((_, i) => i % 1000);
    assert.deepEqual(rang(molts), { min: 0, max: 999 });
    assert.throws(() => Math.min(...molts), RangeError);
  });
});

describe('GeoTIFF', () => {
  it("s'escriu i es torna a llegir sense perdre res", async () => {
    const llegida = await llegirMalla(aGeoTiff(MALLA));
    assert.equal(llegida.x0, MALLA.x0);
    assert.equal(llegida.y0, MALLA.y0);
    assert.equal(llegida.costat, MALLA.costat);
    assert.equal(llegida.columnes, MALLA.columnes);
    assert.equal(llegida.files, MALLA.files);
    assert.deepEqual(llegida.valors, MALLA.valors);
    assert.ok(Math.abs(sqmA(llegida, MONTSEC.lat, MONTSEC.lon)! - 21.65601189) < 1e-5);
    assert.equal(sqmA(llegida, 41.9, 1.5), null);
  });
});

describe('descarregaCeles', () => {
  const pagines = [CELES_FONT.slice(0, 10), CELES_FONT.slice(10)];

  function fetchFals(peticions: URL[]) {
    return (async (entrada: string | URL | Request) => {
      const url = new URL(String(entrada));
      peticions.push(url);
      const perPagina = Number(url.searchParams.get('count'));
      const inici = Number(url.searchParams.get('startIndex'));
      const features = pagines[inici / perPagina]?.map((c) => feature(c)) ?? [];
      return new Response(
        JSON.stringify({ ...geojson(features), numberMatched: CELES_FONT.length }),
        {
          headers: { 'content-type': 'application/json' },
        },
      );
    }) as typeof fetch;
  }

  it("demana la capa en EPSG:25831 pàgina a pàgina fins que s'acaben", async () => {
    const peticions: URL[] = [];
    const celes = await descarregaCeles({ fetch: fetchFals(peticions), perPagina: 10 });
    assert.equal(celes.length, CELES_FONT.length);
    assert.equal(peticions.length, 2);
    const params = peticions[0]!.searchParams;
    assert.equal(peticions[0]!.origin + peticions[0]!.pathname, FONT_SQM.wfs);
    assert.equal(params.get('typeNames'), FONT_SQM.capa);
    assert.equal(params.get('srsName'), 'EPSG:25831');
    assert.equal(params.get('outputFormat'), 'application/json');
    assert.equal(params.get('sortBy'), 'ID');
    assert.equal(peticions[1]!.searchParams.get('startIndex'), '10');
  });

  it('falla si el servidor respon amb error o dona menys cel·les de les que anuncia', async () => {
    const error = (async () => new Response('', { status: 403 })) as typeof fetch;
    await assert.rejects(descarregaCeles({ fetch: error }), /ha respost 403/);
    const curt = (async () =>
      new Response(
        JSON.stringify({ ...geojson([feature(CELES_FONT[0]!)]), numberMatched: 2 }),
      )) as typeof fetch;
    await assert.rejects(descarregaCeles({ fetch: curt }), /anunciava 2/);
  });
});
