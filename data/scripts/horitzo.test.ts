/**
 * Tests del perfil d'horitzó (TG-116). `node --test` de Node 22, sense xarxa: les malles són
 * sintètiques (un pla, una paret, el mar) perquè el resultat es pugui calcular a mà.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AIGUA,
  FONT_MET,
  PERFIL,
  descarregaFinestra,
  elevacioA,
  esFinestra,
  finestra,
  nordGeografic,
  parsejaArcGrid,
  perfilHoritzo,
  rangsAzimut,
  type Malla,
  type Nivell,
} from './horitzo.ts';
import { SENSE_DADA, utm31 } from './mapa-foscor.ts';

/** Al meridià central del fus (3° E) el nord de la quadrícula és el geogràfic. */
const LLOC = { lat: 41.8, lon: 3 };
const { x: X, y: Y } = utm31(LLOC.lat, LLOC.lon);
const NIVELL: Nivell = { semicostat: 5_000, cela: 10 };

/** Malla d'un sol nivell centrada al lloc, amb la cota que doni `cota(dx, dy)` (metres des del lloc). */
function malla(cota: (dx: number, dy: number) => number): Malla {
  const f = finestra(X, Y, NIVELL);
  const valors = new Float32Array(f.columnes * f.files);
  for (let fila = 0; fila < f.files; fila++) {
    for (let col = 0; col < f.columnes; col++) {
      const cx = f.x0 + (col + 0.5) * f.costat;
      const cy = f.y0 - (fila + 0.5) * f.costat;
      valors[fila * f.columnes + col] = cota(cx - X, cy - Y);
    }
  }
  return { ...f, valors };
}

const perfil = (m: Malla, p?: Parameters<typeof perfilHoritzo>[4]) =>
  perfilHoritzo(LLOC.lat, LLOC.lon, [m], [NIVELL], p);

describe('parsejaArcGrid', () => {
  it('llegeix la capçalera i els valors, de nord a sud, amb els forats com a SENSE_DADA', () => {
    const m = parsejaArcGrid(
      'NCOLS 3\nNROWS 2\nXLLCORNER 1000.0\nYLLCORNER 2000.0\nCELLSIZE 5.0\nNODATA_VALUE -9999.0\n' +
        '1 2 3\n4 -9999.0 6\n',
    );
    assert.deepEqual(
      { x0: m.x0, y0: m.y0, costat: m.costat, columnes: m.columnes, files: m.files },
      { x0: 1000, y0: 2010, costat: 5, columnes: 3, files: 2 },
    );
    assert.deepEqual([...m.valors], [1, 2, 3, 4, SENSE_DADA, 6]);
  });

  it('rebutja una excepció del servidor i un ArcGrid amb valors de menys', () => {
    assert.throws(() => parsejaArcGrid('<?xml version="1.0"?><ServiceExceptionReport/>'), /error/);
    assert.throws(
      () => parsejaArcGrid('NCOLS 2\nNROWS 2\nXLLCORNER 0\nYLLCORNER 0\nCELLSIZE 1\n1 2 3\n'),
      /3 valors/,
    );
  });
});

describe('finestra', () => {
  it("s'alinea a la cel·la i es retalla a l'extensió del model", () => {
    const f = finestra(300_002, 4_650_004, { semicostat: 1_500, cela: 5 });
    assert.deepEqual(f, { x0: 298_500, y0: 4_651_505, costat: 5, columnes: 600, files: 600 });
    // El Mont Caro: la finestra de 50 km sortiria per l'oest de l'extensió.
    const { x, y } = utm31(40.80313, 0.34311);
    const gran = finestra(x, y, { semicostat: 50_000, cela: 200 });
    assert.equal(gran.x0, Math.ceil(FONT_MET.extensio.minX / 200) * 200);
    assert.ok(gran.columnes < 500 && gran.files < 500);
  });

  it('demana al WCS exactament la finestra i comprova la que torna', async () => {
    const f = { x0: 1000, y0: 2010, costat: 5, columnes: 3, files: 2 };
    let url = '';
    const fetchFals = (async (u: URL) => {
      url = String(u);
      return new Response(
        'NCOLS 3\nNROWS 2\nXLLCORNER 1000\nYLLCORNER 2000\nCELLSIZE 5\nNODATA_VALUE -9999\n1 2 3\n4 5 6\n',
      );
    }) as typeof fetch;
    const m = await descarregaFinestra(f, fetchFals);
    assert.ok(esFinestra(m, f));
    const params = new URL(url).searchParams;
    assert.equal(params.get('BBOX'), '1000,2000,1015,2010');
    assert.equal(params.get('WIDTH'), '3');
    assert.equal(params.get('HEIGHT'), '2');
    await assert.rejects(descarregaFinestra({ ...f, columnes: 4 }, fetchFals), /s'esperaven 4 × 2/);
  });
});

describe('elevacioA', () => {
  it('interpola entre els centres de les cel·les i torna null fora o al costat d’un forat', () => {
    const m: Malla = {
      x0: 0,
      y0: 20,
      costat: 10,
      columnes: 3,
      files: 2,
      valors: Float32Array.from([0, 10, SENSE_DADA, 20, 30, 40]),
    };
    assert.equal(elevacioA(m, 5, 15), 0);
    assert.equal(elevacioA(m, 10, 15), 5);
    assert.equal(elevacioA(m, 10, 10), 15);
    assert.equal(elevacioA(m, 20, 15), null);
    assert.equal(elevacioA(m, 50, 50), null);
  });

  it("l'aigua (−8888) és a 0 m", () => {
    const m: Malla = {
      x0: 0,
      y0: 20,
      costat: 10,
      columnes: 2,
      files: 2,
      valors: Float32Array.from([AIGUA, AIGUA, 20, 20]),
    };
    assert.equal(elevacioA(m, 10, 10), 10);
  });
});

describe('nordGeografic', () => {
  it('és 0 al meridià central i positiu a l’oest (el Montsec, uns +1,5°)', () => {
    assert.equal(nordGeografic(41.8, 3), 0);
    const montsec = nordGeografic(42.0246, 0.7368);
    assert.ok(montsec > 1.4 && montsec < 1.6, String(montsec));
    assert.ok(nordGeografic(42.32, 3.3) < 0);
  });
});

describe('perfilHoritzo', () => {
  it('en un pla, l’horitzó és lleugerament sota els 0° per tot arreu', () => {
    const { alcades, incomplets, cota } = perfil(malla(() => 500));
    assert.equal(cota, 500);
    assert.equal(alcades.length, 360);
    assert.deepEqual(incomplets, []);
    assert.ok(alcades.every((a) => a <= 0 && a >= -0.1));
  });

  it('una paret de 100 m a 1 km cap a l’est es veu a uns 5,5° i només cap a l’est', () => {
    const { alcades } = perfil(malla((dx) => (dx >= 1000 ? 100 : 0)));
    // La primera mostra sencera sobre la paret és a 1010 m: atan((100 − 2 − 0,07) / 1010) = 5,54°.
    assert.equal(alcades[90], 5.5);
    assert.equal(alcades[0], alcades[180]);
    assert.ok((alcades[0] ?? 1) <= 0);
    assert.equal(alcades[90], Math.max(...alcades));
  });

  it('el relleu a menys de 50 m no compta (un monticle al costat del punt)', () => {
    const { alcades } = perfil(malla((dx) => (dx > 0 && dx < 40 ? 20 : 0)));
    assert.ok((alcades[90] ?? 9) <= 0);
  });

  it('la corbatura de la Terra abaixa el relleu llunyà', () => {
    // Paret de 100 m a 4 km (primera mostra a 4010 m). Sense corbatura: atan(98 / 4010) = 1,40°.
    // En una Terra de 100 km de radi cau 4010² / 200 km = 80,4 m: atan(17,6 / 4010) = 0,25°.
    const m = malla((dx) => (dx >= 4000 ? 100 : 0));
    const p = { ...PERFIL, refraccio: 0 };
    assert.equal(perfil(m, { ...p, radiTerra: 1e15 }).alcades[90], 1.4);
    assert.equal(perfil(m, { ...p, radiTerra: 100_000 }).alcades[90], 0.3);
  });

  it('el mar (sense dades a tocar de la costa) compta com a nivell del mar i no és incomplet', () => {
    const { alcades, incomplets } = perfil(malla((dx) => (dx < 200 ? 5 : SENSE_DADA)));
    assert.deepEqual(incomplets, []);
    assert.ok((alcades[90] ?? 9) < 0);
  });

  it('si el raig surt del model per terra, l’azimut és incomplet', () => {
    const { incomplets } = perfil(malla((dx) => (dx < 2000 ? 400 : SENSE_DADA)));
    assert.ok(incomplets.includes(90));
    assert.ok(!incomplets.includes(270));
  });

  it('sense cota al punt, llança', () => {
    assert.throws(() => perfil(malla(() => SENSE_DADA)), /no té cota/);
  });
});

describe('rangsAzimut', () => {
  it('agrupa azimuts consecutius, també a través del nord', () => {
    assert.equal(rangsAzimut([10, 11, 12, 40]), '10–12°, 40°');
    assert.equal(rangsAzimut([358, 359, 0, 1, 90]), '90°, 358–1°');
    assert.equal(rangsAzimut([]), '');
  });
});
