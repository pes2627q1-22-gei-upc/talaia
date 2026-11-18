import type {
  EsdevenimentRecomanacions,
  IndexHora,
  ObjectiuObservacio,
  ParametresRecomanacions,
  Recomanacio,
  RecomanacionsResposta,
} from '@talaia/shared';

import type { EsdevenimentsRepository } from '../esdeveniments/esdevenimentsRepository';
import { nightWindow, upcomingNight } from '../index/night';
import { ApiError } from '../middleware/errors';
import { iniciHora } from '../punts/puntsService';
import { puntLocalitzat } from '../punts/localitzacio';
import { finestraEsdeveniment, type FinestraEsdeveniment } from './finestra';
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
  getRecomanacions(
    consulta: ParametresRecomanacions,
    now?: Date,
    acceptLanguage?: string,
  ): Promise<RecomanacionsResposta>;
};

/** La consulta amb els valors per defecte omplerts i la franja ja en UTC, `[desDe, finsA)`. */
export type ConsultaResolta = {
  objectiu: ObjectiuObservacio;
  data: string;
  tempsMaxim: number | null;
  limit: number;
  franja: { desDe: Date; finsA: Date };
};

/**
 * Omple el que falta de la consulta («A prop meu», TG-133): la nit que toca (`upcomingNight`: a
 * partir de les 06:00, la que ve), la nit sencera si no hi ha franja, 60 minuts en cotxe,
 * `cel_estrellat` i 20 punts. Amb només una de `desDe` i `finsA` no se sap quina franja es vol: la
 * ruta ho rebutja abans d'arribar aquí.
 *
 * Amb la `finestra` d'un esdeveniment (TG-140), la nit i la franja són les seves;
 * sense `tempsMaxim`, no es limita el radi (`null`, TG-141).
 */
export function resolConsulta(
  consulta: ParametresRecomanacions,
  now: Date,
  finestra?: FinestraEsdeveniment,
): ConsultaResolta {
  const data = finestra?.data ?? consulta.data ?? upcomingNight(now);
  const { desDe, finsA } = consulta;
  let franja: ConsultaResolta['franja'];
  if (finestra) {
    franja = { desDe: finestra.desDe, finsA: finestra.finsA };
  } else if (desDe !== undefined && finsA !== undefined) {
    franja = franjaUtc(data, desDe, finsA);
  } else {
    const nit = nightWindow(data);
    franja = { desDe: nit.from, finsA: nit.to };
  }
  return {
    objectiu: consulta.objectiu ?? OBJECTIU_PER_DEFECTE,
    data,
    tempsMaxim: consulta.tempsMaxim ?? (finestra ? null : TEMPS_MAXIM_PER_DEFECTE),
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
  const [primera, ...resta] = hores;
  if (!primera) return { millorHora: null, mitjana: null, horesAmbIndex: 0 };
  const millorHora = resta.reduce((millor, h) => (h.valor > millor.valor ? h : millor), primera);
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

/** La distància pot compensar fins a 10 punts d’índex, a raó d’1 punt per cada 30 km. */
export const EVENT_DISTANCE_KM_PER_POINT = 30;
export const EVENT_MAX_DISTANCE_PENALTY = 10;
const EVENT_QUALITY_LEVEL = { tap: 0, jus: 1, ras: 2 } as const;

/**
 * TG-141: dins del mateix nivell de qualitat (ras/jus/tap), puntua l’índex màxim
 * menys la penalització de distància. La puntuació només ordena: no modifica l’índex real.
 * Sense índex, al final per distància. Desempats: proximitat, índex exacte, mitjana i id.
 */
export function compareEventRecommendations(a: Recomanacio, b: Recomanacio): number {
  const level = (point: Recomanacio) =>
    point.millorHora ? EVENT_QUALITY_LEVEL[point.millorHora.franja] : -1;
  const score = (point: Recomanacio) =>
    point.millorHora
      ? point.millorHora.valor -
        Math.min(EVENT_MAX_DISTANCE_PENALTY, point.distanciaKm / EVENT_DISTANCE_KM_PER_POINT)
      : 0;
  return (
    level(b) - level(a) ||
    score(b) - score(a) ||
    a.distanciaKm - b.distanciaKm ||
    comparaRecomanacions(a, b) ||
    a.id.localeCompare(b.id)
  );
}

/** Construeix el rànquing a partir dels punts candidats i del seu índex. */
export function rankeja(
  punts: PuntCandidat[],
  index: IndexHoraPunt[],
  rutes: EstimadorRutes,
  compare = comparaRecomanacions,
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
    .sort(compare);
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

/** D'on es llegeix l'esdeveniment d'una consulta amb `esdevenimentId`: el calendari de TG-138. */
export type EsdevenimentsFont = Pick<EsdevenimentsRepository, 'findPublicById'>;

/**
 * L'esdeveniment i la seva finestra (`finestraEsdeveniment`). El mateix 404 que
 * `GET /esdeveniments/{id}`, i 400 `franja_passada` si ja s'ha acabat.
 */
async function finestraDe(
  esdeveniments: EsdevenimentsFont | undefined,
  id: string,
  now: Date,
): Promise<{ esdeveniment: EsdevenimentRecomanacions; finestra: FinestraEsdeveniment }> {
  if (!esdeveniments) {
    throw new ApiError(503, 'database_unavailable', 'Ara mateix no es pot llegir el calendari');
  }
  const fila = await fromDatabase(() => esdeveniments.findPublicById(id));
  if (!fila) {
    throw new ApiError(404, 'event_not_found', `No hi ha cap esdeveniment publicable amb id ${id}`);
  }
  const finestra = finestraEsdeveniment(fila, now);
  if (!finestra) {
    throw new ApiError(400, 'franja_passada', `L'esdeveniment ${id} ja s'ha acabat`);
  }
  return {
    esdeveniment: {
      id: fila.codi,
      inici: fila.inici.toISOString(),
      maxim: fila.maxim?.toISOString() ?? null,
      fi: fila.fi.toISOString(),
    },
    finestra,
  };
}

/**
 * L'índex v1 (ADR-0018) és el mateix per a tots els objectius: l'adaptació per fenomen arriba en
 * sprints posteriors. Per això `objectiu` es valida però encara no canvia el rànquing.
 *
 * Amb `esdevenimentId` (HU11, TG-140), el rànquing és el de la finestra de l'esdeveniment
 * (`finestraEsdeveniment`). L'índex **màxim** de la finestra
 * (`millorHora`) es combina amb la proximitat: dins de ras/jus/tap, es resten
 * fins a 10 punts d’índex, a raó d’un punt per cada 30 km (només per ordenar).
 * Sense `tempsMaxim`, es considera tot el catàleg publicat, sense tall de distància.
 */
export function createRecomanacionsService(
  repository: RecomanacionsRepository,
  rutes: EstimadorRutes = rutesEnLiniaRecta,
  esdeveniments?: EsdevenimentsFont,
): RecomanacionsService {
  return {
    async getRecomanacions(parametres, now = new Date(), acceptLanguage) {
      const delEsdeveniment =
        parametres.esdevenimentId === undefined
          ? undefined
          : await finestraDe(esdeveniments, parametres.esdevenimentId, now);
      const { franja, ...consulta } = resolConsulta(parametres, now, delEsdeveniment?.finestra);
      const horaActual = iniciHora(now);
      if (franja.finsA <= horaActual) {
        throw new ApiError(400, 'franja_passada', 'La franja horària demanada ja ha passat');
      }
      const desDe = franja.desDe > horaActual ? franja.desDe : horaActual;
      const radiKm = consulta.tempsMaxim === null ? null : rutes.radiKm(consulta.tempsMaxim);

      const punts = await fromDatabase(() =>
        repository.puntsDinsRadi(parametres.origen, radiKm === null ? null : radiKm * 1000),
      );
      const index = await fromDatabase(() =>
        repository.indexHores(
          punts.map((p) => p.id),
          desDe,
          franja.finsA,
        ),
      );

      const resposta: RecomanacionsResposta = {
        data: consulta.data,
        tempsMaxim: consulta.tempsMaxim,
        radiKm,
        franja: { desDe: desDe.toISOString(), finsA: franja.finsA.toISOString() },
        total: punts.length,
        punts: rankeja(
          punts.map((p) => puntLocalitzat(p, acceptLanguage)),
          index,
          rutes,
          delEsdeveniment ? compareEventRecommendations : comparaRecomanacions,
        ).slice(0, consulta.limit),
      };
      if (!delEsdeveniment) return resposta;
      resposta.esdeveniment = delEsdeveniment.esdeveniment;
      // Cap hora amb índex (més enllà de la previsió): els punts ja surten per distància.
      if (punts.length > 0 && index.length === 0) resposta.avis = 'sense_previsio';
      return resposta;
    },
  };
}
