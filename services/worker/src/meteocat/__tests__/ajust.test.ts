import type { OpenMeteoClient } from '@talaia/index';
import type { PrevisioMeteoHora } from '@talaia/shared';

import {
  BIAIX_MAXIM,
  PARELLES_MINIMES,
  ajustaHumitatXema,
  biaixAplicable,
  biaixHumitat,
  distanciaKm,
  parellesHumitat,
  type AjustHumitatRepository,
  type EstacioAmbBiaix,
  type LecturaHumitat,
} from '../ajust';

const HORA_MS = 3_600_000;

// Una estació del Pirineu (Lleida), a prop de l'hora de la nit: a les 23:00 UTC és de nit.
const ESTACIO = { lat: 41.7, lon: 1.8, altitud: 300 };
const NIT = '2026-11-20T23:00:00.000Z';
const DIA = '2026-11-20T11:00:00.000Z';

const previsio = (hora: string, humitat: number | null): PrevisioMeteoHora => ({
  hora,
  nuvolsTotal: 0,
  nuvolsBaixos: 0,
  nuvolsMitjans: 0,
  nuvolsAlts: 0,
  humitat,
  visibilitat: 30_000,
  temperatura: 8,
  puntRosada: 2,
  precipitacio: 0,
  probabilitatPrecipitacio: 0,
  ventVelocitat: 5,
  ventRafegues: 10,
  ventDireccio: 0,
});

const lectura = (data: string, humitat: number | null): LecturaHumitat => ({ data, humitat });

describe('biaix de la humitat (ADR-0038)', () => {
  const parelles = (n: number, diferencia: number) =>
    Array.from({ length: n }, () => ({ xema: 50 + diferencia, previsio: 50 }));

  it('sense 48 parelles de nit no hi ha biaix', () => {
    expect(biaixHumitat(parelles(PARELLES_MINIMES - 1, 3))).toBeNull();
    expect(biaixHumitat([])).toBeNull();
  });

  it('amb prou parelles, és la diferència XEMA − Open-Meteo', () => {
    expect(biaixHumitat(parelles(PARELLES_MINIMES, 3))).toBe(3);
    expect(biaixHumitat(parelles(PARELLES_MINIMES, -2.5))).toBe(-2.5);
  });

  it('la mediana no la mou una lectura dolenta', () => {
    const bones = parelles(PARELLES_MINIMES, 2);
    const dolentes = [...bones.slice(0, 5).map((p) => ({ ...p, xema: 100 }))];
    // 5 de 48 lectures dolentes (+50): la mediana segueix a +2.
    expect(biaixHumitat([...bones.slice(5), ...dolentes])).toBe(2);
  });

  it('es retalla a ±15 i s’arrodoneix a la dècima', () => {
    expect(biaixHumitat(parelles(PARELLES_MINIMES, 40))).toBe(BIAIX_MAXIM);
    expect(biaixHumitat(parelles(PARELLES_MINIMES, -40))).toBe(-BIAIX_MAXIM);
    expect(biaixHumitat(parelles(PARELLES_MINIMES, 2.345))).toBe(2.3);
  });
});

describe('parelles de nit', () => {
  it('aparella l’hora amb la mitjana de les lectures h − 30 min i h', () => {
    const p = parellesHumitat(
      [previsio(NIT, 70)],
      [lectura('2026-11-20T22:30:00.000Z', 80), lectura('2026-11-20T23:00:00.000Z', 84)],
      ESTACIO,
    );
    expect(p).toEqual([{ xema: 82, previsio: 70 }]);
  });

  it('no compta les hores de dia, ni les que els falta una lectura o la humitat', () => {
    const lectures = [
      lectura('2026-11-20T10:30:00.000Z', 80),
      lectura('2026-11-20T11:00:00.000Z', 80),
      lectura('2026-11-20T22:30:00.000Z', 80),
    ];
    expect(parellesHumitat([previsio(DIA, 70)], lectures, ESTACIO)).toEqual([]);
    expect(parellesHumitat([previsio(NIT, 70)], lectures, ESTACIO)).toEqual([]);
    expect(parellesHumitat([previsio(NIT, null)], lectures, ESTACIO)).toEqual([]);
  });
});

describe('quan s’aplica el biaix a un punt', () => {
  const punt = { lat: 41.7, lon: 1.8, altitud: 320 };
  const ara = new Date('2026-11-20T06:15:00.000Z');
  const estacio = (sobre: Partial<EstacioAmbBiaix> = {}): EstacioAmbBiaix => ({
    lat: 41.75,
    lon: 1.8,
    altitud: 300,
    biaixHumitat: 4,
    biaixCalculatEl: new Date('2026-11-19T06:15:00.000Z'),
    ...sobre,
  });

  it('una estació propera, de la mateixa altitud i amb biaix recent, s’aplica', () => {
    expect(distanciaKm(punt, estacio())).toBeLessThan(25);
    expect(biaixAplicable(punt, estacio(), ara)).toBe(4);
  });

  it('no s’aplica sense estació, sense biaix o si el biaix té més de 7 dies', () => {
    expect(biaixAplicable(punt, null, ara)).toBeNull();
    expect(biaixAplicable(punt, estacio({ biaixHumitat: null }), ara)).toBeNull();
    expect(
      biaixAplicable(punt, estacio({ biaixCalculatEl: new Date('2026-11-12T06:15:00.000Z') }), ara),
    ).toBeNull();
  });

  it('no s’aplica a més de 25 km, ni amb més de 350 m de diferència d’altitud', () => {
    expect(biaixAplicable(punt, estacio({ lat: 42.2 }), ara)).toBeNull();
    expect(biaixAplicable(punt, estacio({ altitud: 1000 }), ara)).toBeNull();
  });

  it('sense una de les dues altituds no es pot comprovar: no s’aplica', () => {
    expect(biaixAplicable({ ...punt, altitud: null }, estacio(), ara)).toBeNull();
    expect(biaixAplicable(punt, estacio({ altitud: null }), ara)).toBeNull();
  });
});

describe('ajustaHumitatXema', () => {
  /** Una setmana de nits a l'estació: Open-Meteo a 80 %, i la XEMA a 84 % (+4 de biaix). */
  const setmana = () => {
    const hores: PrevisioMeteoHora[] = [];
    const lectures: LecturaHumitat[] = [];
    const inici = Date.parse('2026-11-13T00:00:00.000Z');
    for (let i = 0; i < 7 * 24; i++) {
      const t = inici + i * HORA_MS;
      hores.push(previsio(new Date(t).toISOString(), 80));
      lectures.push(lectura(new Date(t - HORA_MS / 2).toISOString(), 84));
      lectures.push(lectura(new Date(t).toISOString(), 84));
    }
    return { hores, lectures };
  };

  const repositori = (lectures: LecturaHumitat[]) => {
    const repo: AjustHumitatRepository & {
      desats: Array<{ codi: string; biaix: number | null; mostres: number }>;
    } = {
      desats: [],
      estacionsAssignades: jest.fn(async () => [
        { codi: 'CC', ...ESTACIO, biaixHumitat: null, biaixCalculatEl: null },
      ]),
      lecturesHumitat: jest.fn(async () => lectures),
      desaBiaix: jest.fn(async (codi, { biaix, mostres }) => {
        repo.desats.push({ codi, biaix, mostres });
      }),
      ultimCalcul: jest.fn(async () => null),
    };
    return repo;
  };

  const ara = new Date('2026-11-20T06:15:00.000Z');

  it('calcula el biaix de cada estació amb els dies passats d’Open-Meteo', async () => {
    const { hores, lectures } = setmana();
    const repo = repositori(lectures);
    const meteo: OpenMeteoClient = { previsio: jest.fn(async () => [hores]) };

    const resum = await ajustaHumitatXema({ meteo, repository: repo, ara });

    expect(meteo.previsio).toHaveBeenCalledWith([{ lat: ESTACIO.lat, lon: ESTACIO.lon }]);
    expect(resum).toEqual({ calculat: true, estacions: 1, amb: 1 });
    expect(repo.desats).toHaveLength(1);
    expect(repo.desats[0]).toMatchObject({ codi: 'CC', biaix: 4 });
    expect(repo.desats[0]?.mostres).toBeGreaterThanOrEqual(PARELLES_MINIMES);
  });

  it('si Open-Meteo falla, no desa res: el biaix anterior es manté', async () => {
    const repo = repositori([]);
    const meteo: OpenMeteoClient = {
      previsio: jest.fn(async () => {
        throw new Error('xarxa');
      }),
    };
    await expect(ajustaHumitatXema({ meteo, repository: repo, ara })).rejects.toThrow('xarxa');
    expect(repo.desaBiaix).not.toHaveBeenCalled();
  });

  it('no es torna a calcular si ja s’ha fet avui', async () => {
    const repo = repositori([]);
    repo.ultimCalcul = jest.fn(async () => new Date('2026-11-20T03:00:00.000Z'));
    const meteo: OpenMeteoClient = { previsio: jest.fn(async () => []) };

    const resum = await ajustaHumitatXema({ meteo, repository: repo, ara });

    expect(resum.calculat).toBe(false);
    expect(meteo.previsio).not.toHaveBeenCalled();
  });
});
