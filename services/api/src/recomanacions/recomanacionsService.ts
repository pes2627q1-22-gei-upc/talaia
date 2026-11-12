import type {
  IndexHora,
  ObjectiuObservacio,
  ParametresRecomanacions,
  Recomanacio,
  RecomanacionsResposta,
} from '@talaia/shared';

import { defaultNight, nightWindow } from '../index/night';
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
/** Temps en cotxe de «A prop meu» (HU02, TG-133) si la consulta no en porta: ≈ 46 km en línia recta. */
export const TEMPS_MAXIM_PER_DEFECTE = 60;
/** Objectiu si la consulta no en porta. L'índex v1 és el mateix per a tots (ADR-0018). */
export const OBJECTIU_PER_DEFECTE: ObjectiuObservacio = 'cel_estrellat';

export type RecomanacionsService = {
  /**
   * El rànquing de punts per a la consulta; el que no hi és pren el valor per defecte
   * (`resolConsulta`). `now` decideix la nit per defecte i quines hores de la franja queden.
   */
  getRecomanacions(consulta: ParametresRecomanacions, now?: Date): Promise<RecomanacionsResposta>;
};

/** La consulta amb els valors per defecte omplerts i la franja ja en UTC, `[desDe, finsA)`. */
export type ConsultaResolta = {
  objectiu: ObjectiuObservacio;
  data: string;
  tempsMaxim: number;
  limit: number;
  franja: { desDe: Date; finsA: Date };
};

/**
 * Omple el que falta de la consulta («A prop meu», TG-133): la nit en curs (`defaultNight`), la nit
 * sencera si no hi ha franja, 60 minuts en cotxe, `cel_estrellat` i 20 punts. Amb només una de
 * `desDe` i `finsA` no se sap quina franja es vol: la ruta ho rebutja abans d'arribar aquí.
 */
export function resolConsulta(consulta: ParametresRecomanacions, now: Date): ConsultaResolta {
  const data = consulta.data ?? defaultNight(now);
  const { desDe, finsA } = consulta;
  let franja: ConsultaResolta['franja'];
  if (desDe !== undefined && finsA !== undefined) {
    franja = franjaUtc(data, desDe, finsA);
  } else {
    const nit = nightWindow(data);
    franja = { desDe: nit.from, finsA: nit.to };
  }
  return {
    objectiu: consulta.objectiu ?? OBJECTIU_PER_DEFECTE,
    data,
    tempsMaxim: consulta.tempsMaxim ?? TEMPS_MAXIM_PER_DEFECTE,
    limit: consulta.limit ?? LIMIT_PER_DEFECTE,
    franja,
  };
}

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
    async getRecomanacions(parametres, now = new Date()) {
      const { franja, ...consulta } = resolConsulta(parametres, now);
      const horaActual = iniciHora(now);
      if (franja.finsA <= horaActual) {
        throw new ApiError(400, 'franja_passada', 'La franja horària demanada ja ha passat');
      }
      const desDe = franja.desDe > horaActual ? franja.desDe : horaActual;
      const radiKm = rutes.radiKm(consulta.tempsMaxim);

      const punts = await fromDatabase(() =>
        repository.puntsDinsRadi(parametres.origen, radiKm * 1000),
      );
      const index = await fromDatabase(() =>
        repository.indexHores(
          punts.map((p) => p.id),
          desDe,
          franja.finsA,
        ),
      );

      return {
        data: consulta.data,
        tempsMaxim: consulta.tempsMaxim,
        radiKm,
        franja: { desDe: desDe.toISOString(), finsA: franja.finsA.toISOString() },
        total: punts.length,
        punts: rankeja(punts, index, rutes).slice(0, consulta.limit),
      };
    },
  };
}
