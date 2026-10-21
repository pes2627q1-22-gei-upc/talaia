import { lat, lon, type DB } from '@talaia/db';
import type { Kysely } from 'kysely';

import { createKyselyIndexRepository } from '../index/repository';
import type { RecalculDeps } from './recalcul';

/** Els ports del recàlcul sobre la base de dades (ADR-0013). */
export function createKyselyRecalculRepositories(
  db: Kysely<DB>,
): Pick<RecalculDeps, 'punts' | 'indexs' | 'execucions'> {
  return {
    punts: {
      async listPublicats() {
        const files = await db
          .selectFrom('puntsObservacio')
          .select((eb) => [
            'id',
            'altitud',
            'sqm',
            lon(eb.ref('ubicacio')).as('lon'),
            lat(eb.ref('ubicacio')).as('lat'),
          ])
          .where('estat', '=', 'PUBLICAT')
          .orderBy('slug')
          .execute();
        // `numeric` arriba com a cadena: el client de Postgres no el converteix per no perdre precisió.
        return files.map((f) => ({ ...f, sqm: f.sqm === null ? null : Number(f.sqm) }));
      },
    },
    indexs: {
      ...createKyselyIndexRepository(db),
      async esborraAnteriors(abans) {
        await db.deleteFrom('indexVisibilitat').where('hora', '<', abans).execute();
      },
    },
    execucions: {
      async registra({ iniciadaEl, acabadaEl, estat, punts, hores, error }) {
        await db
          .insertInto('execucionsWorker')
          .values({ iniciadaEl, acabadaEl, estat, punts, hores, error: error ?? null })
          .execute();
      },
    },
  };
}
