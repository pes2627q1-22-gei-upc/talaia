import { ApiError } from '../middleware/errors';
import {
  createContentHashCache,
  type MapDocumentCache,
  type VersionedMapDocument,
} from './documentCache';
import { buildMapDocument, filterByBbox, type Bbox } from './mapDocument';
import type { PuntsRepository } from './puntsRepository';

export type PuntsService = {
  /** El document del mapa, sencer o retallat per `bbox`. L'`ETag` és el de la col·lecció. */
  getMapDocument(bbox?: Bbox): Promise<VersionedMapDocument>;
};

export function createPuntsService(cache: MapDocumentCache): PuntsService {
  return {
    async getMapDocument(bbox) {
      let doc: VersionedMapDocument;
      try {
        doc = await cache.get();
      } catch (err) {
        console.error("[punts] no s'ha pogut llegir el catàleg", err);
        throw new ApiError(
          503,
          'database_unavailable',
          'Ara mateix no es pot llegir el catàleg de punts',
        );
      }
      return bbox ? { ...doc, geojson: filterByBbox(doc.geojson, bbox) } : doc;
    },
  };
}

const HORA_MS = 3_600_000;

/** Inici de l'hora en curs (UTC): és la `hora` amb què el worker desa l'índex. */
export function iniciHora(now: Date): Date {
  return new Date(Math.floor(now.getTime() / HORA_MS) * HORA_MS);
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
  );
}
