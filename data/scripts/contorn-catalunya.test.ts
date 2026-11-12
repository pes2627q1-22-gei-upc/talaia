/**
 * Tests del contorn de Catalunya (TG-130, ADR-0031). `node --test` de Node 22, sense xarxa: les
 * províncies són quadrats sintètics, perquè la unió i les àrees es puguin calcular a mà.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FONT_CONTORN,
  aModul,
  anellsProvincies,
  areaKm2,
  contornCatalunya,
  descarregaProvincies,
  dinsAnell,
  simplifica,
  unio,
  urlProvincies,
  type Anell,
  type Punt,
} from './contorn-catalunya.ts';

/** Quadrat en sentit antihorari (l'exterior a GeoJSON), de `[lon, lat]` amb costat `c` graus. */
const quadrat = ([lon, lat]: Punt, c: number): Anell => [
  [lon, lat],
  [lon + c, lat],
  [lon + c, lat + c],
  [lon, lat + c],
  [lon, lat],
];
const invers = (anell: Anell): Anell => [...anell].reverse();

/** Una província com la dona el WFS: un MultiPolygon amb el codi. */
const provincia = (codi: string, ...poligons: Anell[][]) => ({
  type: 'Feature',
  properties: { CODIPROV: codi },
  geometry: { type: 'MultiPolygon', coordinates: poligons },
});

/**
 * Quatre províncies en una quadrícula de 2 × 2 de 0,1° al voltant de (1,5, 41,5). Girona té un
 * enclavament lluny (com Llívia) i Tarragona, un illot de 30 × 30 m. Lleida té un forat que omple
 * Barcelona (un enclavament d'una província dins d'una altra).
 */
function provincies() {
  const forat = quadrat([1.42, 41.52], 0.02);
  return {
    type: 'FeatureCollection',
    features: [
      provincia('08', [quadrat([1.4, 41.4], 0.1)], [forat]),
      provincia('17', [quadrat([1.5, 41.4], 0.1)], [quadrat([1.8, 41.45], 0.03)]),
      provincia('25', [quadrat([1.4, 41.5], 0.1), invers(forat)]),
      provincia('43', [quadrat([1.5, 41.5], 0.1)], [quadrat([1.7, 41.6], 0.0003)]),
    ],
  };
}

describe('urlProvincies i descarregaProvincies', () => {
  it('demana la capa de províncies en GeoJSON i WGS84', () => {
    const url = urlProvincies();
    assert.equal(url.origin + url.pathname, FONT_CONTORN.wfs);
    assert.equal(url.searchParams.get('typeNames'), FONT_CONTORN.capa);
    assert.equal(url.searchParams.get('outputFormat'), 'GEOJSON');
    assert.equal(url.searchParams.get('srsName'), 'urn:ogc:def:crs:EPSG::4326');
  });

  it('torna el GeoJSON, i un error si el WFS no respon bé', async () => {
    const ok = (async () =>
      Response.json({ type: 'FeatureCollection', features: [] })) as typeof fetch;
    assert.deepEqual(await descarregaProvincies({ fetch: ok }), {
      type: 'FeatureCollection',
      features: [],
    });
    const error = (async () => new Response('', { status: 503 })) as typeof fetch;
    await assert.rejects(descarregaProvincies({ fetch: error }), /503/);
  });
});

describe('anellsProvincies', () => {
  it('llegeix els anells de cada província', () => {
    const anells = anellsProvincies(provincies());
    assert.equal(anells.length, 4);
    assert.equal(anells[0]?.length, 2);
  });

  it('rebutja una resposta que no és de les quatre províncies o amb els eixos girats', () => {
    assert.throws(() => anellsProvincies({ type: 'Feature' }), /FeatureCollection/);
    const tres = provincies();
    tres.features.pop();
    assert.throws(() => anellsProvincies(tres), /províncies/);
    const girada = provincies();
    girada.features[0]!.geometry.coordinates = [
      [quadrat([1.4, 41.4], 0.1).map(([lon, lat]) => [lat, lon] as Punt)],
    ];
    assert.throws(() => anellsProvincies(girada), /no és a Catalunya/);
  });
});

describe('unio', () => {
  it('treu la frontera interna de dues províncies veïnes', () => {
    const anells = unio([[quadrat([1.4, 41.4], 0.1)], [quadrat([1.5, 41.4], 0.1)]]);
    assert.equal(anells.length, 1);
    const area = areaKm2(anells[0]!);
    const sumes = areaKm2(quadrat([1.4, 41.4], 0.1)) * 2;
    assert.ok(Math.abs(area - sumes) < 1e-9, `${area} ≠ ${sumes}`);
    // La frontera interna (lon = 1,5) només hi és pels extrems.
    const interns = anells[0]!.filter(([lon, lat]) => lon === 1.5 && lat > 41.4 && lat < 41.5);
    assert.deepEqual(interns, []);
  });

  it("un enclavament d'una província dins d'una altra no deixa cap forat", () => {
    const forat = quadrat([1.42, 41.42], 0.02);
    const anells = unio([[quadrat([1.4, 41.4], 0.1), invers(forat)], [forat]]);
    assert.equal(anells.length, 1);
    assert.ok(areaKm2(anells[0]!) > 0);
  });

  it('manté separats els polígons que no es toquen, com Llívia', () => {
    const anells = unio([[quadrat([1.4, 41.4], 0.1)], [quadrat([1.8, 41.45], 0.03)]]);
    assert.equal(anells.length, 2);
    for (const a of anells) assert.deepEqual(a[0], a.at(-1));
  });
});

describe('areaKm2, dinsAnell i simplifica', () => {
  it("l'àrea és positiva en sentit antihorari i negativa en l'horari", () => {
    const q = quadrat([1.4, 41.4], 0.1);
    // 0,1° de longitud a 41,7° són 8,3 km i 0,1° de latitud, 11,06 km.
    assert.ok(Math.abs(areaKm2(q) - 8.311 * 11.057) < 0.1);
    assert.equal(areaKm2(invers(q)), -areaKm2(q));
  });

  it('distingeix dins i fora', () => {
    const q = quadrat([1.4, 41.4], 0.1);
    assert.equal(dinsAnell([1.45, 41.45], q), true);
    assert.equal(dinsAnell([1.55, 41.45], q), false);
  });

  it('treu els vèrtexs que no s’aparten més de la tolerància i manté els altres', () => {
    // Un quadrat amb punts sobre els costats i un pic de 300 m al costat de dalt.
    const anell: Anell = [
      [1.4, 41.4],
      [1.45, 41.40001],
      [1.5, 41.4],
      [1.5, 41.45],
      [1.5, 41.5],
      [1.45, 41.5 + 300 / 110_574],
      [1.4, 41.5],
      [1.4, 41.4],
    ];
    const s = simplifica(anell, 200);
    assert.deepEqual(s[0], s.at(-1));
    assert.ok(!s.some(([lon, lat]) => lon === 1.45 && lat === 41.40001));
    assert.ok(!s.some(([lon, lat]) => lon === 1.5 && lat === 41.45));
    assert.ok(s.some(([lon]) => lon === 1.45));
    assert.equal(
      simplifica(anell, 400).some(([lon]) => lon === 1.45),
      false,
    );
  });
});

describe('contornCatalunya', () => {
  it('fa un MultiPolygon amb el contorn i l’enclavament, sense l’illot ni fronteres internes', () => {
    const contorn = contornCatalunya(provincies());
    assert.equal(contorn.length, 2);
    // El gran primer: els quatre quadrats, sense forats.
    assert.equal(contorn[0]!.length, 1);
    assert.ok(Math.abs(areaKm2(contorn[0]![0]!) - 4 * 8.311 * 11.057) < 0.5);
    // L'enclavament, sencer.
    assert.ok(contorn[1]![0]!.some(([lon]) => lon === 1.8));
  });

  it('desa els forats grans dins del seu polígon i arrodoneix les coordenades', () => {
    // Un forat de 0,05° (uns 23 km²) que no omple cap província, com si fos un altre país.
    const forat = quadrat([1.41, 41.51], 0.05);
    const geojson = {
      type: 'FeatureCollection',
      features: [
        provincia('08', [quadrat([1.4, 41.4], 0.1)]),
        provincia('17', [quadrat([1.5, 41.4], 0.1)]),
        provincia('25', [quadrat([1.4, 41.5], 0.1), invers(forat)]),
        provincia('43', [quadrat([1.5, 41.5], 0.1)]),
      ],
    };
    const contorn = contornCatalunya(geojson, { decimals: 2 });
    assert.equal(contorn[0]!.length, 2);
    assert.ok(areaKm2(contorn[0]![1]!) < 0);
    for (const [lon, lat] of contorn.flat(2)) {
      assert.equal(lon, Math.round(lon * 100) / 100);
      assert.equal(lat, Math.round(lat * 100) / 100);
    }
  });
});

describe('aModul', () => {
  it('escriu el mòdul de TypeScript amb la font, la tolerància i les coordenades', () => {
    const contorn = contornCatalunya(provincies());
    const modul = aModul(contorn, { consulta: '2026-11-12', toleranciaM: 200 });
    assert.match(modul, /GENERAT per\s+\* data\/scripts\/build-contorn-catalunya\.ts/);
    assert.match(modul, /export const TOLERANCIA_CONTORN_M = 200;/);
    assert.match(
      modul,
      /export const CONTORN_CATALUNYA: \[lon: number, lat: number\]\[\]\[\]\[\] = \[/,
    );
    assert.match(modul, /consultat el 2026-11-12/);
    assert.match(modul, /\[1\.4, 41\.4\],/);
    // Les coordenades es poden tornar a llegir tal com s'han escrit.
    const cos = modul
      .slice(modul.indexOf('= [') + 2)
      .replace(/,(\s*\])/g, '$1')
      .replace(/;\s*$/, '');
    assert.deepEqual(JSON.parse(cos), contorn);
  });
});
