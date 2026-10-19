/**
 * Tests de la validació del catàleg de punts (`validarPunts`), sobre el GeoJSON real amb la
 * propietat que es prova canviada a tots els punts.
 *
 *   npm run test --workspace data
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SQM, llegirPunts, serialitzarPunts, validarPunts, type PuntsFC } from './punts.ts';

const RUTA = fileURLToPath(new URL('../punts_observacio.geojson', import.meta.url));
const FC = llegirPunts(RUTA);

function amb(camp: 'sqm' | 'horitzo', valor: unknown): PuntsFC {
  return {
    ...FC,
    features: FC.features.map(
      (f) => ({ ...f, properties: { ...f.properties, [camp]: valor } }) as never,
    ),
  };
}

const errorsSqm = (sqm: unknown) => validarPunts(amb('sqm', sqm)).filter((e) => e.includes('sqm'));
/** `\b` deixa fora `horitzo_obert`. */
const errorsHoritzo = (horitzo: unknown) =>
  validarPunts(amb('horitzo', horitzo)).filter((e) => /horitzo\b/.test(e));

describe('validarPunts: sqm', () => {
  it('el catàleg actual és vàlid', () => {
    assert.deepEqual(validarPunts(FC, { exigirAltitud: true }), []);
  });

  it('accepta tots els valors de 2 decimals del rang de la font, també els que la coma flotant embruta', () => {
    assert.notEqual(16.01 * 100, 1601); // el motiu del test
    for (let centesimes = 1399; centesimes <= 2172; centesimes++) {
      assert.deepEqual(errorsSqm(centesimes / 100), [], String(centesimes / 100));
    }
    assert.deepEqual(errorsSqm(Math.round(21.656011 * 100) / 100), []); // com arrodoneix fill-sqm.ts
    assert.deepEqual(errorsSqm(null), []);
  });

  it('rebutja més de 2 decimals, valors fora de rang i la propietat absent', () => {
    assert.match(errorsSqm(16.015)[0] ?? '', /2 decimals/);
    assert.match(errorsSqm(SQM.max + 0.01)[0] ?? '', /entre 10 i 23/);
    assert.match(errorsSqm('18.5')[0] ?? '', /entre 10 i 23/);
    assert.match(errorsSqm(undefined)[0] ?? '', /falta la propietat sqm/);
  });
});

describe('validarPunts: horitzo', () => {
  it('accepta 360 alçades amb 1 decimal, també negatives, i null', () => {
    assert.deepEqual(errorsHoritzo(Array.from({ length: 360 }, (_, i) => (i - 180) / 10)), []);
    assert.deepEqual(errorsHoritzo(null), []);
  });

  it("rebutja una llista curta, més d'1 decimal, valors fora de rang i la propietat absent", () => {
    assert.match(errorsHoritzo([1, 2, 3])[0] ?? '', /360 alçades/);
    assert.match(errorsHoritzo(Array(360).fill(1.25))[0] ?? '', /1 decimal/);
    assert.match(errorsHoritzo(Array(360).fill(91))[0] ?? '', /entre -90 i 90/);
    assert.match(errorsHoritzo(undefined)[0] ?? '', /falta la propietat horitzo/);
  });
});

describe('serialitzarPunts', () => {
  it('escriu el GeoJSON versionat tal com és (el format de Prettier, perfils llargs inclosos)', () => {
    assert.equal(serialitzarPunts(FC), readFileSync(RUTA, 'utf8'));
  });
});
