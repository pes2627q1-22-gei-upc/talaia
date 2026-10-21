import type { ConsultaRecomanacions, IndexHora } from '@talaia/shared';

import { ApiError } from '../../middleware/errors';
import type {
  IndexHoraPunt,
  PuntCandidat,
  RecomanacionsRepository,
} from '../recomanacionsRepository';
import { createRecomanacionsService, resumeix } from '../recomanacionsService';

const HORA_MS = 3_600_000;

const hora = (iso: string, valor: number): IndexHora => ({
  hora: iso,
  valor,
  franja: valor >= 70 ? 'ras' : valor >= 40 ? 'jus' : 'tap',
  factors: { nuvols: 1, sol: 1, foscor: 0.6, lluna: 1 },
  foscorEstimada: false,
});

const punt = (id: string, distanciaM: number): PuntCandidat => ({
  id,
  nom: `Punt ${id}`,
  municipi: 'Municipi',
  lat: 42,
  lon: 1.5,
  distanciaM,
});

// Nit del 15 al 16 de desembre de 2026 (CET): de 22 a 6 locals = de 21:00 a 05:00 UTC.
const CONSULTA: ConsultaRecomanacions = {
  objectiu: 'cel_estrellat',
  origen: { lat: 41.3874, lon: 2.1686 },
  data: '2026-12-15',
  desDe: 22,
  finsA: 6,
  tempsMaxim: 150,
};
const ABANS = new Date('2026-12-15T10:20:00Z');
const H = (n: number) => new Date(Date.parse('2026-12-15T21:00:00Z') + n * HORA_MS).toISOString();

function fakeRepository(punts: PuntCandidat[], index: IndexHoraPunt[], error?: Error) {
  const crides: { radi?: number; origen?: unknown; rang?: [string[], Date, Date] } = {};
  const repository: RecomanacionsRepository = {
    async puntsDinsRadi(origen, metres) {
      if (error) throw error;
      crides.origen = origen;
      crides.radi = metres;
      return punts;
    },
    async indexHores(ids, desDe, finsA) {
      crides.rang = [ids, desDe, finsA];
      return index.filter(
        (i) =>
          ids.includes(i.puntId) && Date.parse(i.hora) >= +desDe && Date.parse(i.hora) < +finsA,
      );
    },
  };
  return { repository, crides };
}

describe('resumeix', () => {
  it('sense hores, millorHora i mitjana són null', () => {
    expect(resumeix([])).toEqual({ millorHora: null, mitjana: null, horesAmbIndex: 0 });
  });

  it("la millor hora és la de l'índex més alt; si n'hi ha d'empatades, la primera", () => {
    const hores = [hora(H(0), 40), hora(H(1), 81), hora(H(2), 81), hora(H(3), 20)];
    const { millorHora, mitjana, horesAmbIndex } = resumeix(hores);
    expect(millorHora?.hora).toBe(H(1));
    expect(mitjana).toBe(56); // 222 / 4 = 55,5
    expect(horesAmbIndex).toBe(4);
  });
});

describe('recomanacionsService.getRecomanacions', () => {
  afterEach(() => jest.restoreAllMocks());

  it('demana els punts dins del radi de tempsMaxim i l’índex de la franja en UTC', async () => {
    const { repository, crides } = fakeRepository([punt('a', 10_000)], []);
    const res = await createRecomanacionsService(repository).getRecomanacions(CONSULTA, ABANS);

    expect(res.radiKm).toBe(115.4);
    expect(crides.radi).toBe(115_400);
    expect(crides.origen).toEqual(CONSULTA.origen);
    expect(res.franja).toEqual({ desDe: H(0), finsA: H(8) });
    expect(crides.rang).toEqual([['a'], new Date(H(0)), new Date(H(8))]);
  });

  it('ordena per la millor hora, després per la mitjana i després per la distància', async () => {
    const { repository } = fakeRepository(
      [punt('a', 5_000), punt('b', 20_000), punt('c', 30_000), punt('d', 40_000), punt('e', 1_000)],
      [
        // a: millor 60
        { puntId: 'a', ...hora(H(0), 60) },
        // b: millor 90, mitjana 60
        { puntId: 'b', ...hora(H(0), 90) },
        { puntId: 'b', ...hora(H(1), 30) },
        // c: millor 90, mitjana 90
        { puntId: 'c', ...hora(H(3), 90) },
        // d: millor 90, mitjana 90, més lluny que c
        { puntId: 'd', ...hora(H(2), 90) },
        // e: sense índex
      ],
    );
    const res = await createRecomanacionsService(repository).getRecomanacions(CONSULTA, ABANS);

    expect(res.punts.map((p) => p.id)).toEqual(['c', 'd', 'b', 'a', 'e']);
    expect(res.punts[0]).toMatchObject({
      distanciaKm: 30,
      tempsEstimat: 39,
      mitjana: 90,
      horesAmbIndex: 1,
      millorHora: { hora: H(3), valor: 90, franja: 'ras' },
    });
    expect(res.punts[4]).toMatchObject({
      id: 'e',
      millorHora: null,
      mitjana: null,
      horesAmbIndex: 0,
    });
    expect(res.punts[0]).not.toHaveProperty('distanciaM');
  });

  it('sense índex per a la nit (més enllà de la previsió): tots els punts per distància', async () => {
    const { repository } = fakeRepository([punt('a', 9_000), punt('b', 2_000)], []);
    const res = await createRecomanacionsService(repository).getRecomanacions(CONSULTA, ABANS);
    expect(res.punts.map((p) => [p.id, p.millorHora])).toEqual([
      ['b', null],
      ['a', null],
    ]);
  });

  it('retorna 20 punts per defecte, o els de limit, i el total dins del radi', async () => {
    const punts = Array.from({ length: 30 }, (_, k) => punt(`p${k}`, 1_000 * (k + 1)));
    const { repository } = fakeRepository(punts, []);
    const servei = createRecomanacionsService(repository);

    const perDefecte = await servei.getRecomanacions(CONSULTA, ABANS);
    expect(perDefecte.total).toBe(30);
    expect(perDefecte.punts).toHaveLength(20);

    const cinc = await servei.getRecomanacions({ ...CONSULTA, limit: 5 }, ABANS);
    expect(cinc.total).toBe(30);
    expect(cinc.punts.map((p) => p.id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
  });

  it('el límit es fa després d’ordenar: el millor punt hi és encara que sigui el més llunyà', async () => {
    const punts = Array.from({ length: 30 }, (_, k) => punt(`p${k}`, 1_000 * (k + 1)));
    const { repository } = fakeRepository(punts, [{ puntId: 'p29', ...hora(H(0), 70) }]);
    const res = await createRecomanacionsService(repository).getRecomanacions(
      { ...CONSULTA, limit: 1 },
      ABANS,
    );
    expect(res.punts.map((p) => p.id)).toEqual(['p29']);
  });

  it('arrodoneix la distància a 1 decimal', async () => {
    const { repository } = fakeRepository([punt('a', 12_345)], []);
    const res = await createRecomanacionsService(repository).getRecomanacions(CONSULTA, ABANS);
    expect(res.punts[0]?.distanciaKm).toBe(12.3);
  });

  it("si la franja ja ha començat, només compten les hores des de l'hora en curs", async () => {
    const { repository, crides } = fakeRepository(
      [punt('a', 1_000)],
      [
        { puntId: 'a', ...hora(H(0), 95) },
        { puntId: 'a', ...hora(H(3), 50) },
      ],
    );
    const now = new Date(Date.parse(H(2)) + 25 * 60_000);
    const res = await createRecomanacionsService(repository).getRecomanacions(CONSULTA, now);

    expect(res.franja.desDe).toBe(H(2));
    expect(crides.rang?.[1]).toEqual(new Date(H(2)));
    expect(res.punts[0]?.millorHora?.valor).toBe(50);
  });

  it('si la franja ja ha acabat → 400 franja_passada, sense tocar la base de dades', async () => {
    const { repository, crides } = fakeRepository([punt('a', 1_000)], []);
    const promesa = createRecomanacionsService(repository).getRecomanacions(
      CONSULTA,
      new Date(H(8)),
    );
    await expect(promesa).rejects.toMatchObject({ status: 400, code: 'franja_passada' });
    expect(crides.radi).toBeUndefined();
  });

  it('cap punt dins del radi: llista buida', async () => {
    const { repository } = fakeRepository([], []);
    const res = await createRecomanacionsService(repository).getRecomanacions(CONSULTA, ABANS);
    expect(res.punts).toEqual([]);
  });

  it('un error de la base de dades → 503 database_unavailable', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { repository } = fakeRepository([], [], new Error('connexió tancada'));
    const promesa = createRecomanacionsService(repository).getRecomanacions(CONSULTA, ABANS);
    await expect(promesa).rejects.toBeInstanceOf(ApiError);
    await expect(promesa).rejects.toMatchObject({ status: 503, code: 'database_unavailable' });
  });
});
