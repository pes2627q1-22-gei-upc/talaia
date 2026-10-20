import type { IndexHora, PuntFitxa } from '@talaia/shared';

import { ApiError } from '../middleware/errors';
import {
  createContentHashCache,
  type MapDocumentCache,
  type VersionedMapDocument,
} from './documentCache';
import { buildMapDocument, filterByBbox, type Bbox } from './mapDocument';
import type { PuntsRepository } from './puntsRepository';

const HORA_MS = 3_600_000;

export type PuntsService = {
  /** El document del mapa, sencer o retallat per `bbox`. L'`ETag` és el de la col·lecció. */
  getMapDocument(bbox?: Bbox): Promise<VersionedMapDocument>;
  /** La fitxa d'un punt publicat amb l'índex de l'hora en curs i de les `hores` següents. */
  getFitxa(id: string, hores: number, now?: Date): Promise<PuntFitxa>;
};

/** Inici de l'hora en curs (UTC): és la `hora` amb què el worker desa l'índex. */
export function iniciHora(now: Date): Date {
  return new Date(Math.floor(now.getTime() / HORA_MS) * HORA_MS);
}

/** Separa l'índex de l'hora en curs del de les hores següents (les files ja venen ordenades). */
export function splitIndexHores(files: IndexHora[], horaActual: Date): PuntFitxa['index'] {
  const actual = horaActual.getTime();
  return {
    actual: files.find((f) => Date.parse(f.hora) === actual) ?? null,
    properesHores: files.filter((f) => Date.parse(f.hora) > actual),
  };
}

/** Un error de la base de dades arriba al client com a 503, i el detall queda al log. */
async function fromDatabase<T>(context: string, query: () => Promise<T>): Promise<T> {
  try {
    return await query();
  } catch (err) {
    console.error(`[punts] ${context}`, err);
    throw new ApiError(
      503,
      'database_unavailable',
      'Ara mateix no es pot llegir el catàleg de punts',
    );
  }
}

export function createPuntsService(
  cache: MapDocumentCache,
  repository: PuntsRepository,
): PuntsService {
  return {
    async getMapDocument(bbox) {
      const doc = await fromDatabase("no s'ha pogut llegir el catàleg", () => cache.get());
      return bbox ? { ...doc, geojson: filterByBbox(doc.geojson, bbox) } : doc;
    },

    async getFitxa(id, hores, now = new Date()) {
      const horaActual = iniciHora(now);
      const finsA = new Date(horaActual.getTime() + (hores + 1) * HORA_MS);
      const [punt, files] = await fromDatabase(`no s'ha pogut llegir el punt ${id}`, () =>
        Promise.all([repository.findPublished(id), repository.indexHores(id, horaActual, finsA)]),
      );
      if (!punt) {
        throw new ApiError(404, 'punt_not_found', `No hi ha cap punt publicat amb id ${id}`);
      }
      return { ...punt, index: splitIndexHores(files, horaActual) };
    },
  };
}

/**
 * El servei amb la memòria cau per defecte: es regenera en canviar l'hora (l'índex del mapa és
 * el de l'hora en curs), quan el worker acaba una execució i, si no, com a molt cada 5 minuts.
 */
export function createDefaultPuntsService(
  repository: PuntsRepository,
  now: () => number = Date.now,
): PuntsService {
  return createPuntsService(
    createContentHashCache(
      async (hora = iniciHora(new Date(now())).getTime()) =>
        buildMapDocument(await repository.listPublished(new Date(hora))),
      {
        period: (t) => iniciHora(new Date(t)).getTime(),
        version: async () => (await repository.indexVersion()) ?? 'cap',
        now,
      },
    ),
    repository,
  );
}
