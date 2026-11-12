import {
  OpenMeteoError,
  calculaIndex,
  efemeridesHora,
  type Coordenades,
  type OpenMeteoClient,
} from '@talaia/index';
import type { ConsultaVisibilitat, PrevisioMeteoHora, VisibilitatUbicacio } from '@talaia/shared';

import { ApiError } from '../middleware/errors';
import { iniciHora } from '../punts/puntsService';
import { isInCatalonia } from './catalunya';
import { createLruCache, type CacheStatus } from './lruCache';

/**
 * L'índex d'una ubicació qualsevol de Catalunya, calculat al moment (HU05, ADR-0004, ADR-0031):
 * la previsió d'Open-Meteo de la cel·la, les efemèrides de l'hora i la fórmula v1 de
 * `@talaia/index`, la mateixa que fa servir el worker per als punts del catàleg.
 */

const HORA_MS = 3_600_000;

/** Hores endavant que es poden consultar: les que 4 dies de previsió cobreixen sempre. */
export const HORES_CONSULTABLES = 72;
/** Cel·les per grau: 0,01° (~1 km) és la clau de la memòria cau i on es calcula l'índex. */
export const CELLES_PER_GRAU = 100;
/** Distància màxima a un punt del catàleg per fer servir el seu SQM: la cel·la del mapa (1 km). */
export const RADI_SQM_M = 1_000;
/** Temps màxim per llegir l'SQM: una base de dades lenta no ha de fer esperar la resposta. */
export const TIMEOUT_SQM_MS = 1_000;
/** Cel·les a la memòria cau (unes 40 KB cadascuna). */
export const MAX_CELLES = 500;
/** Peticions a Open-Meteo per hora (UTC), com a molt: la quota de 10.000 crides/dia és compartida amb el worker. */
export const MAX_PREVISIONS_PER_HORA = 250;
/** Consultes noves (que criden Open-Meteo) per client i hora (UTC), com a molt. */
export const MAX_PREVISIONS_PER_CLIENT = 20;
/** Si Open-Meteo falla, una previsió caducada fa menys d'això encara se serveix (`X-Cache: STALE`). */
export const MAX_ANTIGUITAT_STALE_MS = 6 * HORA_MS;
/** Minut de cada hora (UTC) en què el worker torna a demanar la previsió (ADR-0024). */
export const MINUT_ACTUALITZACIO = 5;

/** El punt publicat amb SQM més proper a `metres` o menys, o `null` si no n'hi ha cap. */
export type SqmProper = (
  lloc: Coordenades,
  metres: number,
) => Promise<(Coordenades & { sqm: number }) | null>;

/** Capçalera `X-Cache`: d'on surt la previsió de la cel·la (vegeu `CacheStatus`). */
export type EstatCache = Uppercase<CacheStatus>;

export type ResultatVisibilitat = { resposta: VisibilitatUbicacio; cache: EstatCache };

export type VisibilitatService = {
  /** `client`: qui consulta (l'adreça IP), per al límit de consultes noves per client. */
  getVisibilitat(consulta: ConsultaVisibilitat, client?: string): Promise<ResultatVisibilitat>;
};

export type VisibilitatDeps = {
  /** El client d'Open-Meteo de `@talaia/index`. */
  meteo: OpenMeteoClient;
  /** Sense base de dades (`DATABASE_URL`), cap: la foscor és sempre estimada. */
  sqmProper?: SqmProper;
  now?: () => number;
  maxCelles?: number;
  maxPrevisionsPerHora?: number;
  maxPrevisionsPerClient?: number;
  timeoutSqmMs?: number;
};

/**
 * La foscor d'una cel·la: l'SQM del punt del catàleg més proper i si és de la mateixa cel·la
 * (mesurada) o d'una de veïna (prestada, i per tant estimada). `null`: cap punt prou a prop.
 */
type FoscorCella = { sqm: number; mesurada: boolean } | null;

/** La cel·la de la ubicació: les coordenades arrodonides a 0,01° (`CELLES_PER_GRAU`). */
export function cellaDe(lat: number, lon: number): Coordenades {
  const arrodoneix = (graus: number) => Math.round(graus * CELLES_PER_GRAU) / CELLES_PER_GRAU;
  return { lat: arrodoneix(lat), lon: arrodoneix(lon) };
}

const mateixaCella = (a: Coordenades, b: Coordenades) => {
  const ca = cellaDe(a.lat, a.lon);
  const cb = cellaDe(b.lat, b.lon);
  return ca.lat === cb.lat && ca.lon === cb.lon;
};

/**
 * Fins quan val una previsió demanada a `t`: fins al minut 5 següent, quan el worker també en
 * demana una de nova (ADR-0024).
 */
export function properaActualitzacio(t: number): number {
  const actualitzacio = Math.floor(t / HORA_MS) * HORA_MS + MINUT_ACTUALITZACIO * 60_000;
  return actualitzacio > t ? actualitzacio : actualitzacio + HORA_MS;
}

/** Rebutja si `promesa` no acaba en `ms` mil·lisegons. */
function ambTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`sense resposta en ${ms} ms`)), ms);
    promesa.then(
      (valor) => {
        clearTimeout(timer);
        resolve(valor);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Comptador de finestra fixa per hora (UTC): quantes vegades ha passat cada clau aquesta hora. */
function comptadorHorari(now: () => number) {
  let hora = 0;
  const comptes = new Map<string, number>();
  const alDia = () => {
    const ara = iniciHora(new Date(now())).getTime();
    if (ara !== hora) {
      hora = ara;
      comptes.clear();
    }
  };
  return {
    compte(clau: string) {
      alDia();
      return comptes.get(clau) ?? 0;
    },
    suma(clau: string) {
      alDia();
      comptes.set(clau, (comptes.get(clau) ?? 0) + 1);
    },
    /** Segons fins a l'hora següent, quan tots els comptes tornen a zero. */
    segonsFinsAZero: () => Math.ceil((hora + HORA_MS - now()) / 1000),
  };
}

const foraDeCatalunya = () =>
  new ApiError(
    422,
    'fora_de_catalunya',
    'Aquesta ubicació és fora de Catalunya: Talaia només calcula la visibilitat dins de Catalunya',
  );

const senseDades = () =>
  new ApiError(
    422,
    'hora_sense_previsio',
    `No hi ha previsió per a aquesta hora: es pot consultar des de l'hora en curs fins a ${HORES_CONSULTABLES} hores endavant`,
  );

const meteoNoDisponible = (missatge: string) => new ApiError(503, 'meteo_unavailable', missatge);

/** Clau del comptador global (cap adreça IP no és una cadena buida). */
const TOTHOM = '';

export function createVisibilitatService({
  meteo,
  sqmProper,
  now = Date.now,
  maxCelles = MAX_CELLES,
  maxPrevisionsPerHora = MAX_PREVISIONS_PER_HORA,
  maxPrevisionsPerClient = MAX_PREVISIONS_PER_CLIENT,
  timeoutSqmMs = TIMEOUT_SQM_MS,
}: VisibilitatDeps): VisibilitatService {
  const previsions = createLruCache<PrevisioMeteoHora[]>({
    maxEntries: maxCelles,
    maxStaleMs: MAX_ANTIGUITAT_STALE_MS,
    now,
  });
  const foscors = createLruCache<FoscorCella>({ maxEntries: maxCelles, now });
  const consultes = comptadorHorari(now);
  /** L'hora en què s'ha avisat al log del sostre global: només un avís per hora. */
  let sostreAvisat = 0;

  /**
   * Comprova i compta una petició nova a Open-Meteo: primer el límit del client (429) i després
   * el sostre global (503). Només compta si de debò es crida Open-Meteo.
   */
  const comptaPrevisio = (client: string | undefined) => {
    if (client !== undefined && consultes.compte(client) >= maxPrevisionsPerClient) {
      throw new ApiError(
        429,
        'too_many_requests',
        `Has consultat ${maxPrevisionsPerClient} llocs nous aquesta hora: torna-ho a provar més tard. Els que ja has consultat es poden continuar consultant`,
        { 'Retry-After': String(consultes.segonsFinsAZero()) },
      );
    }
    if (consultes.compte(TOTHOM) >= maxPrevisionsPerHora) {
      const hora = iniciHora(new Date(now())).getTime();
      if (sostreAvisat !== hora) {
        sostreAvisat = hora;
        console.warn(`[visibilitat] sostre de ${maxPrevisionsPerHora} previsions per hora assolit`);
      }
      throw meteoNoDisponible(
        "S'ha arribat al màxim de consultes de previsió d'aquesta hora: torna-ho a provar més tard",
      );
    }
    consultes.suma(TOTHOM);
    if (client !== undefined) consultes.suma(client);
  };

  const carregaPrevisio = async (cella: Coordenades, client: string | undefined) => {
    comptaPrevisio(client);
    const demanadaEl = now();
    const [previsio = []] = await meteo.previsio([cella]).catch((err: unknown) => {
      // Sense les coordenades al log: són la ubicació de qui consulta (TG-253).
      const motiu = err instanceof OpenMeteoError ? err.message : String(err);
      console.error(`[visibilitat] Open-Meteo no ha respost: ${motiu}`);
      throw meteoNoDisponible('Ara mateix no es pot obtenir la previsió meteorològica');
    });
    const desDe = iniciHora(new Date(demanadaEl)).getTime();
    return {
      value: previsio.filter((h) => Date.parse(h.hora) >= desDe),
      expiresAt: properaActualitzacio(demanadaEl),
    };
  };

  /**
   * La foscor de la cel·la, amb el seu propi timeout. Un error o un timeout no impedeixen l'índex
   * (la foscor passa a ser estimada) i no es desen: la petició següent ho torna a provar.
   */
  const foscorDe = async (cella: Coordenades): Promise<FoscorCella> => {
    if (!sqmProper) return null;
    try {
      const { value } = await foscors.get(`${cella.lat},${cella.lon}`, async () => {
        const punt = await ambTimeout(sqmProper(cella, RADI_SQM_M), timeoutSqmMs);
        return {
          value: punt && { sqm: punt.sqm, mesurada: mateixaCella(punt, cella) },
          expiresAt: properaActualitzacio(now()),
        };
      });
      return value;
    } catch (err) {
      const motiu = err instanceof Error ? err.message : String(err);
      console.error(`[visibilitat] no s'ha pogut llegir l'SQM (${motiu}); la foscor serà estimada`);
      return null;
    }
  };

  return {
    async getVisibilitat({ lat, lon, hora }, client) {
      if (!isInCatalonia(lat, lon)) throw foraDeCatalunya();

      const ara = iniciHora(new Date(now())).getTime();
      const instant = iniciHora(hora === undefined ? new Date(now()) : new Date(hora)).getTime();
      if (instant < ara || instant > ara + HORES_CONSULTABLES * HORA_MS) throw senseDades();

      const cella = cellaDe(lat, lon);
      const esLHora = (h: PrevisioMeteoHora) => Date.parse(h.hora) === instant;
      const [previsio, foscor] = await Promise.all([
        previsions.get(
          `${cella.lat},${cella.lon}`,
          () => carregaPrevisio(cella, client),
          (hores) => hores.some(esLHora),
        ),
        foscorDe(cella),
      ]);
      const meteoHora = previsio.value.find(esLHora);
      if (!meteoHora) throw senseDades();

      const calculat = calculaIndex({
        meteo: meteoHora,
        efemerides: efemeridesHora(cella, meteoHora.hora),
        sqm: foscor?.sqm ?? null,
      });
      // Un SQM prestat d'una cel·la veïna es fa servir, però no es dona per mesurat.
      const index = foscor?.mesurada === false ? { ...calculat, foscorEstimada: true } : calculat;
      return {
        resposta: { ...cella, sqm: foscor?.sqm ?? null, index, deDia: index.factors.sol === 0 },
        cache: previsio.status.toUpperCase() as EstatCache,
      };
    },
  };
}
