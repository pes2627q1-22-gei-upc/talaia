import { OpenMeteoError, type Coordenades, type OpenMeteoClient } from '@talaia/index';
import type { PrevisioMeteoHora } from '@talaia/shared';

import { createInMemoryIndexRepository } from '../../index/repository';
import { iniciHora, recalculaIndex, type PuntPerRecalcul } from '../recalcul';

// 21:20 UTC del 16/10: de nit a Catalunya. L'hora en curs comença a les 21:00.
const ARA = new Date('2026-10-16T21:20:00.000Z');
const HORA_MS = 3_600_000;

/** Previsió amb 95 % d'humitat: 5 punts per sobre del llindar de 85 %. */
const previsio = (): PrevisioMeteoHora[] =>
  [-2, -1, 0, 1, 2].map((d) => ({
    hora: new Date(iniciHora(ARA).getTime() + d * HORA_MS).toISOString(),
    nuvolsTotal: 0,
    nuvolsBaixos: 0,
    nuvolsMitjans: 0,
    nuvolsAlts: 0,
    humitat: 95,
    visibilitat: 30_000,
    temperatura: 8,
    puntRosada: 2,
    precipitacio: 0,
    probabilitatPrecipitacio: 0,
    ventVelocitat: 5,
    ventRafegues: 10,
    ventDireccio: 0,
  }));

const meteo: OpenMeteoClient = {
  previsio: jest.fn(async (llocs: Coordenades[]) => llocs.map(() => previsio())),
};

const base = { id: 'p1', lat: 41.5, lon: 1.5, altitud: 500, sqm: 21.5 } satisfies PuntPerRecalcul;

/** Recalcula un punt i torna les hores que queda desades. */
async function recalcula(punt: PuntPerRecalcul) {
  const indexs = { ...createInMemoryIndexRepository(), esborraAnteriors: async () => {} };
  await recalculaIndex({
    punts: { listPublicats: async () => [punt] },
    meteo,
    indexs,
    execucions: { registra: async () => {} },
    ara: () => ARA,
    espera: async () => {},
  });
  return indexs.indexsDe(punt.id);
}

describe('recalcul amb el biaix de la XEMA (TG-184, ADR-0036)', () => {
  it('sense estació amb biaix, la humitat és la d’Open-Meteo tal qual', async () => {
    const hores = await recalcula(base);
    expect(hores.length).toBeGreaterThan(0);
    for (const h of hores) {
      // 95 %: (95 − 85) / 15 = 2/3 de la caiguda, és a dir, 1 − 0,3 × 2/3 = 0,8.
      expect(h.factors.humitat).toBeCloseTo(0.8, 2);
      expect(h.humitatCorregida).toBe(false);
      expect(h.versio).toBe(2);
    }
  });

  it('una estació propera amb biaix recent corregeix la humitat i ho diu', async () => {
    const hores = await recalcula({
      ...base,
      estacio: {
        lat: 41.51,
        lon: 1.5,
        altitud: 500,
        biaixHumitat: 5,
        biaixCalculatEl: new Date(ARA.getTime() - 24 * HORA_MS),
      },
    });
    expect(hores.length).toBeGreaterThan(0);
    for (const h of hores) {
      // 95 + 5 = 100 %: la caiguda és completa, i la humitat fa 0,7.
      expect(h.factors.humitat).toBeCloseTo(0.7, 2);
      expect(h.humitatCorregida).toBe(true);
    }
  });

  it('un biaix de fa més de 7 dies no s’aplica', async () => {
    const hores = await recalcula({
      ...base,
      estacio: {
        lat: 41.51,
        lon: 1.5,
        altitud: 500,
        biaixHumitat: 5,
        biaixCalculatEl: new Date(ARA.getTime() - 8 * 24 * HORA_MS),
      },
    });
    for (const h of hores) expect(h.humitatCorregida).toBe(false);
  });

  it('un error d’Open-Meteo no és un error de la humitat: el recàlcul falla igual que abans', async () => {
    const fallant: OpenMeteoClient = {
      previsio: jest.fn(async () => {
        throw new OpenMeteoError('timeout');
      }),
    };
    await expect(
      recalculaIndex({
        punts: { listPublicats: async () => [base] },
        meteo: fallant,
        indexs: { ...createInMemoryIndexRepository(), esborraAnteriors: async () => {} },
        execucions: { registra: async () => {} },
        ara: () => ARA,
        espera: async () => {},
      }),
    ).rejects.toThrow();
  });
});
