import { lat, lon, type createDb } from '@talaia/db';
import type { DireccioHoritzo, IndexHora, PuntFitxa, PuntObservacio } from '@talaia/shared';

type Db = ReturnType<typeof createDb>;

/** Les dades d'un punt que surten de `punts_observacio` (la fitxa sense l'índex). */
export type PuntDetall = Omit<PuntFitxa, 'index'>;

/** Accés als punts d'observació (ADR-0013): les consultes només s'escriuen aquí. */
export type PuntsRepository = {
  /** Punts visibles al mapa: només els que tenen `estat = 'PUBLICAT'`. */
  listPublished(): Promise<PuntObservacio[]>;
  /** Un punt publicat, o `undefined` si no existeix o no és `PUBLICAT`. */
  findPublished(id: string): Promise<PuntDetall | undefined>;
  /** L'índex d'un punt de les hores `[desDe, finsA)`, en ordre. */
  indexHores(id: string, desDe: Date, finsA: Date): Promise<IndexHora[]>;
};

export function createPuntsRepository(db: Db): PuntsRepository {
  return {
    listPublished: () =>
      db
        .selectFrom('puntsObservacio')
        .select((eb) => [
          'id',
          'nom',
          'municipi',
          lon(eb.ref('ubicacio')).as('lon'),
          lat(eb.ref('ubicacio')).as('lat'),
        ])
        .where('estat', '=', 'PUBLICAT')
        .orderBy('slug')
        .execute(),

    async findPublished(id) {
      const fila = await db
        .selectFrom('puntsObservacio')
        .select((eb) => [
          'id',
          'nom',
          'municipi',
          'descripcio',
          'altitud',
          'horitzoObert',
          'accessibilitat',
          'sqm',
          lon(eb.ref('ubicacio')).as('lon'),
          lat(eb.ref('ubicacio')).as('lat'),
        ])
        .where('id', '=', id)
        .where('estat', '=', 'PUBLICAT')
        .executeTakeFirst();
      if (!fila) return undefined;
      return {
        ...fila,
        // La restricció de la taula només admet aquestes direccions.
        horitzoObert: fila.horitzoObert as DireccioHoritzo[] | null,
        // `numeric` arriba com a text per no perdre precisió; amb 2 decimals, un number n'hi ha prou.
        sqm: fila.sqm === null ? null : Number(fila.sqm),
      };
    },

    async indexHores(id, desDe, finsA) {
      const files = await db
        .selectFrom('indexVisibilitat')
        .select(['hora', 'valor', 'franja', 'factors', 'foscorEstimada'])
        .where('puntId', '=', id)
        .where('hora', '>=', desDe)
        .where('hora', '<', finsA)
        .orderBy('hora')
        .execute();
      return files.map((f) => ({
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
