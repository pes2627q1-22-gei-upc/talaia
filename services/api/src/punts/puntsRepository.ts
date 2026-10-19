import { lat, lon, type createDb } from '@talaia/db';
import type { FranjaIndex, IndexVisibilitat, PuntObservacio } from '@talaia/shared';
import { sql } from 'kysely';

type Db = ReturnType<typeof createDb>;

/** Accés als punts d'observació (ADR-0013): les consultes només s'escriuen aquí. */
/** Un punt del mapa amb l'índex de l'hora en curs (`null` si el worker encara no l'ha calculat). */
export type PuntMapa = PuntObservacio & { index: IndexVisibilitat | null };

export type PuntsRepository = {
  /** Punts visibles al mapa: només els que tenen `estat = 'PUBLICAT'`. */
  listPublished(): Promise<PuntMapa[]>;
  /**
   * Versió de l'índex: quan va acabar l'última execució correcta del worker (ADR-0012, ADR-0024),
   * o `null` si encara no n'hi ha cap.
   */
  indexVersion(): Promise<string | null>;
};

export function createPuntsRepository(db: Db): PuntsRepository {
  return {
    async listPublished() {
      const files = await db
        .selectFrom('puntsObservacio as p')
        .leftJoin('indexVisibilitat as iv', (join) =>
          join
            .onRef('iv.puntId', '=', 'p.id')
            .on('iv.hora', '=', sql<Date>`date_trunc('hour', now())`),
        )
        .select((eb) => [
          'p.id',
          'p.nom',
          'p.municipi',
          lon(eb.ref('p.ubicacio')).as('lon'),
          lat(eb.ref('p.ubicacio')).as('lat'),
          'iv.valor',
          'iv.franja',
        ])
        .where('p.estat', '=', 'PUBLICAT')
        .orderBy('p.slug')
        .execute();
      return files.map(({ valor, franja, ...punt }) => ({
        ...punt,
        // La taula ja limita `franja` a 'tap', 'jus' i 'ras' amb un check.
        index: valor === null || franja === null ? null : { valor, franja: franja as FranjaIndex },
      }));
    },
    async indexVersion() {
      const fila = await db
        .selectFrom('execucionsWorker')
        .select((eb) => eb.fn.max('acabadaEl').as('acabadaEl'))
        .where('estat', '=', 'ok')
        .executeTakeFirst();
      return fila?.acabadaEl ? new Date(fila.acabadaEl).toISOString() : null;
    },
  };
}
