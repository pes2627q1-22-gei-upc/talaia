import type {
  ConsultaRecomanacions,
  IndexHora,
  Recomanacio,
  RecomanacionsResposta,
} from '@talaia/shared';

import { ApiError } from '../middleware/errors';
import { iniciHora } from '../punts/puntsService';
import { franjaUtc } from './franja';
import type {
  IndexHoraPunt,
  PuntCandidat,
  RecomanacionsRepository,
} from './recomanacionsRepository';
import { rutesEnLiniaRecta, type EstimadorRutes } from './rutes';

/** Punts del rànquing si la consulta no en demana un altre nombre. */
export const LIMIT_PER_DEFECTE = 20;

export type RecomanacionsService = {
  /** El rànquing de punts per a la consulta. `now` decideix quines hores de la franja queden. */
  getRecomanacions(consulta: ConsultaRecomanacions, now?: Date): Promise<RecomanacionsResposta>;
};

/**
 * La millor hora (la primera, si n'hi ha d'empatades) i la mitjana arrodonida de l'índex d'un
 * punt. Sense cap hora, totes dues són `null`.
 */
export function resumeix(
  hores: IndexHora[],
): Pick<Recomanacio, 'millorHora' | 'mitjana' | 'horesAmbIndex'> {
  if (hores.length === 0) return { millorHora: null, mitjana: null, horesAmbIndex: 0 };
  const millorHora = hores.reduce((millor, h) => (h.valor > millor.valor ? h : millor));
  const mitjana = Math.round(hores.reduce((suma, h) => suma + h.valor, 0) / hores.length);
  return { millorHora, mitjana, horesAmbIndex: hores.length };
}

/** Ordre del rànquing: millor hora, mitjana i distància. Sense índex, al final per distància. */
export function comparaRecomanacions(a: Recomanacio, b: Recomanacio): number {
  const valor = (r: Recomanacio) => r.millorHora?.valor ?? -1;
  return (
    valor(b) - valor(a) || (b.mitjana ?? -1) - (a.mitjana ?? -1) || a.distanciaKm - b.distanciaKm
  );
}

/** Construeix el rànquing a partir dels punts candidats i del seu índex. */
export function rankeja(
  punts: PuntCandidat[],
  index: IndexHoraPunt[],
  rutes: EstimadorRutes,
): Recomanacio[] {
  const perPunt = new Map<string, IndexHora[]>();
  for (const { puntId, ...hora } of index) {
    const hores = perPunt.get(puntId) ?? [];
    hores.push(hora);
    perPunt.set(puntId, hores);
  }
  return punts
    .map(({ distanciaM, ...punt }) => {
      const distanciaKm = Math.round(distanciaM / 100) / 10;
      return {
        ...punt,
        distanciaKm,
        tempsEstimat: rutes.minuts(distanciaKm),
        ...resumeix(perPunt.get(punt.id) ?? []),
      };
    })
    .sort(comparaRecomanacions);
}

/** Un error de la base de dades arriba al client com a 503, i el detall queda al log. */
async function fromDatabase<T>(query: () => Promise<T>): Promise<T> {
  try {
    return await query();
  } catch (err) {
    console.error("[recomanacions] no s'ha pogut llegir la base de dades", err);
    throw new ApiError(
      503,
      'database_unavailable',
      'Ara mateix no es poden calcular les recomanacions',
    );
  }
}

/**
 * L'índex v1 (ADR-0018) és el mateix per a tots els objectius: l'adaptació per fenomen arriba en
 * sprints posteriors. Per això `objectiu` es valida però encara no canvia el rànquing.
 */
export function createRecomanacionsService(
  repository: RecomanacionsRepository,
  rutes: EstimadorRutes = rutesEnLiniaRecta,
): RecomanacionsService {
  return {
    async getRecomanacions(consulta, now = new Date()) {
      const franja = franjaUtc(consulta.data, consulta.desDe, consulta.finsA);
      const horaActual = iniciHora(now);
      if (franja.finsA <= horaActual) {
        throw new ApiError(400, 'franja_passada', 'La franja horària demanada ja ha passat');
      }
      const desDe = franja.desDe > horaActual ? franja.desDe : horaActual;
      const radiKm = rutes.radiKm(consulta.tempsMaxim);

      const punts = await fromDatabase(() =>
        repository.puntsDinsRadi(consulta.origen, radiKm * 1000),
      );
      const index = await fromDatabase(() =>
        repository.indexHores(
          punts.map((p) => p.id),
          desDe,
          franja.finsA,
        ),
      );

      return {
        radiKm,
        franja: { desDe: desDe.toISOString(), finsA: franja.finsA.toISOString() },
        total: punts.length,
        punts: rankeja(punts, index, rutes).slice(0, consulta.limit ?? LIMIT_PER_DEFECTE),
      };
    },
  };
}
