import type { DB } from '@talaia/db';
import type { IndexHora, PuntObservacio } from '@talaia/shared';
import type { Kysely } from 'kysely';

/**
 * Persistència horària de l'índex (taula `index_visibilitat`): una fila per punt i hora. Tornar
 * a calcular una hora la substitueix, així el worker horari (TG-99) pot recalcular sense duplicar.
 */
export type IndexRepository = {
  desaIndexs(puntId: PuntObservacio['id'], hores: IndexHora[]): Promise<void>;
  indexsDe(puntId: PuntObservacio['id']): Promise<IndexHora[]>;
};

export function createInMemoryIndexRepository(): IndexRepository {
  const perPunt = new Map<string, Map<number, IndexHora>>();
  return {
    async desaIndexs(puntId, hores) {
      const desades = perPunt.get(puntId) ?? new Map<number, IndexHora>();
      for (const h of hores) desades.set(Date.parse(h.hora), h);
      perPunt.set(puntId, desades);
    },
    async indexsDe(puntId) {
      return [...(perPunt.get(puntId)?.values() ?? [])].sort(
        (a, b) => Date.parse(a.hora) - Date.parse(b.hora),
      );
    },
  };
}

export function createKyselyIndexRepository(db: Kysely<DB>): IndexRepository {
  return {
    async desaIndexs(puntId, hores) {
      if (hores.length === 0) return;
      await db
        .insertInto('indexVisibilitat')
        .values(
          hores.map((h) => ({
            puntId,
            hora: h.hora,
            valor: h.valor,
            franja: h.franja,
            factors: h.factors,
            foscorEstimada: h.foscorEstimada,
          })),
        )
        .onConflict((oc) =>
          oc.columns(['puntId', 'hora']).doUpdateSet((eb) => ({
            valor: eb.ref('excluded.valor'),
            franja: eb.ref('excluded.franja'),
            factors: eb.ref('excluded.factors'),
            foscorEstimada: eb.ref('excluded.foscorEstimada'),
            calculatEl: new Date(),
          })),
        )
        .execute();
    },
    async indexsDe(puntId) {
      const files = await db
        .selectFrom('indexVisibilitat')
        .select(['hora', 'valor', 'franja', 'factors', 'foscorEstimada'])
        .where('puntId', '=', puntId)
        .orderBy('hora')
        .execute();
      return files.map((f) => ({
        hora: f.hora.toISOString(),
        valor: f.valor,
        franja: f.franja,
        factors: f.factors as IndexHora['factors'],
        foscorEstimada: f.foscorEstimada,
      }));
    },
  };
}
