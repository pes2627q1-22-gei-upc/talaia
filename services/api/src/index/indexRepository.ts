import type { createDb } from '@talaia/db';
import type { FactorsIndex, IndexHora } from '@talaia/shared';

import type { NightWindow } from './night';

type Db = ReturnType<typeof createDb>;

/** Lectura de la taula `index_visibilitat`, que escriu el worker cada hora (ADR-0018, TG-99). */
export type IndexRepository = {
  /** Les hores calculades d'un punt dins de `[from, to)`, en ordre cronològic. */
  listHours(puntId: string, window: NightWindow): Promise<IndexHora[]>;
};

export function createIndexRepository(db: Db): IndexRepository {
  return {
    async listHours(puntId, { from, to }) {
      const rows = await db
        .selectFrom('indexVisibilitat')
        .select(['hora', 'valor', 'franja', 'factors', 'foscorEstimada'])
        .where('puntId', '=', puntId)
        .where('hora', '>=', from)
        .where('hora', '<', to)
        .orderBy('hora')
        .execute();
      return rows.map((row) => ({
        hora: row.hora.toISOString(),
        valor: row.valor,
        franja: row.franja,
        // La columna és jsonb; qui hi escriu (el worker) hi desa sempre un FactorsIndex.
        factors: row.factors as FactorsIndex,
        foscorEstimada: row.foscorEstimada,
      }));
    },
  };
}
