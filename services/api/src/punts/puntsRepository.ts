import { lat, lon, type createDb } from '@talaia/db';
import type {
  DireccioHoritzo,
  FranjaIndex,
  IndexHora,
  IndexVisibilitat,
  PuntFitxa,
  PuntObservacio,
} from '@talaia/shared';

type Db = ReturnType<typeof createDb>;

/** Les dades d'un punt que surten de `punts_observacio` (la fitxa sense l'índex). */
export type PuntDetall = Omit<PuntFitxa, 'index'>;

/** Un punt del mapa amb l'índex de l'hora en curs (`null` si el worker encara no l'ha calculat). */
export type PuntMapa = PuntObservacio & { index: IndexVisibilitat | null };

/** Accés als punts d'observació (ADR-0013): les consultes només s'escriuen aquí. */
export type PuntsRepository = {
  /** Punts visibles al mapa (`estat = 'PUBLICAT'`), amb l'índex de l'`hora` (inici, en UTC). */
  listPublished(hora: Date): Promise<PuntMapa[]>;
  /**
   * Versió de l'índex: quan va acabar l'última execució del worker que ha desat l'índex d'algun
   * punt (ADR-0012, ADR-0024), o `null` si encara no n'hi ha cap.
   */
  indexVersion(): Promise<string | null>;
  /** Un punt publicat, o `undefined` si no existeix o no és `PUBLICAT`. */
  findPublished(id: string): Promise<PuntDetall | undefined>;
  /** L'índex d'un punt de les hores `[desDe, finsA)`, en ordre. */
  indexHores(id: string, desDe: Date, finsA: Date): Promise<IndexHora[]>;
};

export function createPuntsRepository(db: Db): PuntsRepository {
  return {
    async listPublished(hora) {
      const files = await db
        .selectFrom('puntsObservacio as p')
        .leftJoin('indexVisibilitat as iv', (join) =>
          join.onRef('iv.puntId', '=', 'p.id').on('iv.hora', '=', hora),
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
        // També les execucions amb algun lot fallat: si n'han desat algun, el mapa ha canviat.
        .where('punts', '>', 0)
        .executeTakeFirst();
      return fila?.acabadaEl ? new Date(fila.acabadaEl).toISOString() : null;
    },

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
