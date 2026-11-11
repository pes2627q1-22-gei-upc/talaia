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
import { createLruCache } from './lruCache';

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
/** Distància màxima a un punt del catàleg per fer servir el seu SQM (ADR-0031). */
export const RADI_SQM_M = 5_000;
/** Cel·les a la memòria cau (unes 40 KB cadascuna). */
export const MAX_CELLES = 500;
/** Peticions a Open-Meteo per hora (UTC), com a molt: la quota de 10.000 crides/dia és compartida amb el worker. */
export const MAX_PREVISIONS_PER_HORA = 250;
/** Minut de cada hora (UTC) en què el worker torna a demanar la previsió (ADR-0024). */
export const MINUT_ACTUALITZACIO = 5;

/** El SQM del punt publicat més proper a `metres` o menys, o `null` si no n'hi ha cap. */
export type SqmProper = (lloc: Coordenades, metres: number) => Promise<number | null>;

/** `cache`: `HIT` si la previsió de la cel·la ja era a la memòria cau (capçalera `X-Cache`). */
export type ResultatVisibilitat = { resposta: VisibilitatUbicacio; cache: 'HIT' | 'MISS' };

export type VisibilitatService = {
  getVisibilitat(consulta: ConsultaVisibilitat): Promise<ResultatVisibilitat>;
};

export type VisibilitatDeps = {
  /** El client d'Open-Meteo de `@talaia/index`. */
  meteo: OpenMeteoClient;
  /** Sense base de dades (`DATABASE_URL`), cap: la foscor és sempre estimada. */
  sqmProper?: SqmProper;
  now?: () => number;
  maxCelles?: number;
  maxPrevisionsPerHora?: number;
};

/** El que es desa per cel·la: la previsió de l'hora en curs en endavant i l'SQM del lloc. */
type DadesCella = { previsio: PrevisioMeteoHora[]; sqm: number | null };

/** La cel·la de la ubicació: les coordenades arrodonides a 0,01° (`CELLES_PER_GRAU`). */
export function cellaDe(lat: number, lon: number): Coordenades {
  const arrodoneix = (graus: number) => Math.round(graus * CELLES_PER_GRAU) / CELLES_PER_GRAU;
  return { lat: arrodoneix(lat), lon: arrodoneix(lon) };
}

/**
 * Fins quan val una previsió demanada a `t`: fins al minut 5 següent, quan el worker també en
 * demana una de nova (ADR-0024).
 */
export function properaActualitzacio(t: number): number {
  const actualitzacio = Math.floor(t / HORA_MS) * HORA_MS + MINUT_ACTUALITZACIO * 60_000;
  return actualitzacio > t ? actualitzacio : actualitzacio + HORA_MS;
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

export function createVisibilitatService({
  meteo,
  sqmProper,
  now = Date.now,
  maxCelles = MAX_CELLES,
  maxPrevisionsPerHora = MAX_PREVISIONS_PER_HORA,
}: VisibilitatDeps): VisibilitatService {
  const cache = createLruCache<DadesCella>({ maxEntries: maxCelles, now });
  /** Peticions a Open-Meteo de l'hora en curs (finestra fixa, en UTC). */
  const comptador = { hora: 0, n: 0 };

  /** Compta una petició a Open-Meteo; fals si ja s'ha arribat al sostre d'aquesta hora. */
  const queda = () => {
    const hora = iniciHora(new Date(now())).getTime();
    if (comptador.hora !== hora) Object.assign(comptador, { hora, n: 0 });
    if (comptador.n >= maxPrevisionsPerHora) {
      if (comptador.n === maxPrevisionsPerHora) {
        console.warn(`[visibilitat] sostre de ${maxPrevisionsPerHora} previsions per hora assolit`);
        comptador.n += 1; // Només s'avisa un cop per hora.
      }
      return false;
    }
    comptador.n += 1;
    return true;
  };

  /** Un error de la base de dades no impedeix l'índex: la foscor passa a ser estimada. */
  const sqmDe = async (cella: Coordenades) => {
    if (!sqmProper) return null;
    try {
      return await sqmProper(cella, RADI_SQM_M);
    } catch (err) {
      console.error("[visibilitat] no s'ha pogut llegir l'SQM; la foscor serà estimada", err);
      return null;
    }
  };

  const carrega = async (cella: Coordenades) => {
    if (!queda()) {
      throw meteoNoDisponible(
        "S'ha arribat al màxim de consultes de previsió d'aquesta hora: torna-ho a provar més tard",
      );
    }
    const demanadaEl = now();
    const [previsions, sqm] = await Promise.all([
      meteo.previsio([cella]).catch((err: unknown) => {
        // Sense les coordenades al log: són la ubicació de qui consulta (TG-253).
        const motiu = err instanceof OpenMeteoError ? err.message : String(err);
        console.error(`[visibilitat] Open-Meteo no ha respost: ${motiu}`);
        throw meteoNoDisponible('Ara mateix no es pot obtenir la previsió meteorològica');
      }),
      sqmDe(cella),
    ]);
    const desDe = iniciHora(new Date(demanadaEl)).getTime();
    return {
      value: {
        previsio: (previsions[0] ?? []).filter((h) => Date.parse(h.hora) >= desDe),
        sqm,
      },
      expiresAt: properaActualitzacio(demanadaEl),
    };
  };

  return {
    async getVisibilitat({ lat, lon, hora }) {
      if (!isInCatalonia(lat, lon)) throw foraDeCatalunya();

      const ara = iniciHora(new Date(now())).getTime();
      const instant = iniciHora(hora === undefined ? new Date(now()) : new Date(hora)).getTime();
      if (instant < ara || instant > ara + HORES_CONSULTABLES * HORA_MS) throw senseDades();

      const cella = cellaDe(lat, lon);
      const esLHora = (h: PrevisioMeteoHora) => Date.parse(h.hora) === instant;
      const { value, hit } = await cache.get(
        `${cella.lat},${cella.lon}`,
        () => carrega(cella),
        (dades) => dades.previsio.some(esLHora),
      );
      const meteoHora = value.previsio.find(esLHora);
      if (!meteoHora) throw senseDades();

      const index = calculaIndex({
        meteo: meteoHora,
        efemerides: efemeridesHora(cella, meteoHora.hora),
        sqm: value.sqm,
      });
      return {
        resposta: { ...cella, sqm: value.sqm, index, deDia: index.factors.sol === 0 },
        cache: hit ? 'HIT' : 'MISS',
      };
    },
  };
}
