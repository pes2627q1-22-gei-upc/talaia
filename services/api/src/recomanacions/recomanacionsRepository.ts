import { dinsRadi, distancia, lat, lon, puntDesDeLonLat, type createDb } from '@talaia/db';
import type { IndexHora, PuntObservacio } from '@talaia/shared';

type Db = ReturnType<typeof createDb>;

/** Un punt candidat amb la distància en línia recta a l'origen, en metres. */
export type PuntCandidat = PuntObservacio & { distanciaM: number };

/** L'índex d'una hora d'un punt concret. */
export type IndexHoraPunt = IndexHora & { puntId: string };

/** Accés a les dades de les recomanacions (ADR-0013): les consultes només s'escriuen aquí. */
export type RecomanacionsRepository = {
  /** Punts publicats a `metres` o menys de l'origen, del més proper al més llunyà. */
  puntsDinsRadi(origen: { lat: number; lon: number }, metres: number): Promise<PuntCandidat[]>;
  /** L'índex dels punts `ids` de les hores `[desDe, finsA)`, per punt i per hora. */
  indexHores(ids: string[], desDe: Date, finsA: Date): Promise<IndexHoraPunt[]>;
};

export function createRecomanacionsRepository(db: Db): RecomanacionsRepository {
  return {
    async puntsDinsRadi(origen, metres) {
      const files = await db
        .selectFrom('puntsObservacio')
        .select((eb) => [
          'id',
          'nom',
          'municipi',
          lon(eb.ref('ubicacio')).as('lon'),
          lat(eb.ref('ubicacio')).as('lat'),
          distancia(eb.ref('ubicacio'), puntDesDeLonLat(origen.lon, origen.lat)).as('distanciaM'),
        ])
        .where('estat', '=', 'PUBLICAT')
        .where((eb) =>
          dinsRadi(eb.ref('ubicacio'), puntDesDeLonLat(origen.lon, origen.lat), metres),
        )
        .orderBy('distanciaM')
        .execute();
      // `st_distance` és `double precision`: pg ja el retorna com a number.
      return files.map((f) => ({ ...f, distanciaM: Number(f.distanciaM) }));
    },

    async indexHores(ids, desDe, finsA) {
      if (ids.length === 0) return [];
      const files = await db
        .selectFrom('indexVisibilitat')
        .select(['puntId', 'hora', 'valor', 'franja', 'factors', 'foscorEstimada'])
        .where('puntId', 'in', ids)
        .where('hora', '>=', desDe)
        .where('hora', '<', finsA)
        .orderBy('puntId')
        .orderBy('hora')
        .execute();
      return files.map((f) => ({
        puntId: f.puntId,
        hora: f.hora.toISOString(),
        valor: f.valor,
        franja: f.franja,
        // jsonb sense tipus: l'escriu només el worker, amb `FactorsIndex` (ADR-0018).
        factors: f.factors as IndexHora['factors'],
        foscorEstimada: f.foscorEstimada,
      }));
    },
  };
}
