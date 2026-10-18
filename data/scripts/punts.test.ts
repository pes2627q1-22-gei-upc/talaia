/**
 * Tests de la validació del catàleg de punts (`validarPunts`), sobre el GeoJSON real amb la
 * propietat que es prova canviada a tots els punts.
 *
 *   npm run test --workspace data
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SQM, llegirPunts, validarPunts, type PuntsFC } from './punts.ts';

const FC = llegirPunts(fileURLToPath(new URL('../punts_observacio.geojson', import.meta.url)));

function ambSqm(sqm: unknown): PuntsFC {
  return {
    ...FC,
    features: FC.features.map((f) => ({ ...f, properties: { ...f.properties, sqm } }) as never),
  };
}

const errorsSqm = (sqm: unknown) => validarPunts(ambSqm(sqm)).filter((e) => e.includes('sqm'));

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
