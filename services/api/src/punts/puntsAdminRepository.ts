import { dinsRadi, lat, lon, puntDesDeLonLat, type createDb, type DB } from '@talaia/db';
import type {
  DireccioHoritzo,
  EstatPuntAdmin,
  PuntAdmin,
  PuntAdminCanvis,
  PuntAdminNou,
} from '@talaia/shared';
import { sql, type ExpressionBuilder, type Selectable, type UpdateObject } from 'kysely';

type Db = ReturnType<typeof createDb>;

/**
 * Un canvi de coordenades de menys d'aquests metres és el mateix lloc: l'arrodoniment del
 * formulari o l'error de les coordenades. El perfil d'horitzó ja no compta el relleu dels primers
 * 50 m (ADR-0022) i la foscor és d'una malla d'1 km (ADR-0020).
 */
export const MATEIX_LLOC_M = 10;

/** Accés als punts des de l'administració (HU39, ADR-0013): totes les consultes són aquí. */
export type PuntsAdminRepository = {
  /** Tots els punts, en qualsevol estat, per `slug`. */
  list(): Promise<PuntAdmin[]>;
  /** Un punt en qualsevol estat, o `undefined` si no existeix. */
  find(id: string): Promise<PuntAdmin | undefined>;
  /** Crea un punt `OFICIAL` sense creador; `undefined` si ja hi ha un punt amb aquest `slug`. */
  create(punt: PuntAdminNou & { estat: EstatPuntAdmin }): Promise<PuntAdmin | undefined>;
  /**
   * Aplica els canvis i torna el punt; `undefined` si no existeix. Si el punt es mou (més de
   * `MATEIX_LLOC_M`), el que depèn del lloc torna a `null`: `horitzo`, `estacio_xema` i, si els
   * canvis no en porten cap, `sqm`.
   */
  update(id: string, canvis: PuntAdminCanvis): Promise<PuntAdmin | undefined>;
};

/** Les columnes de `PuntAdmin`, iguals al `select` i al `returning`. */
const columnes = (eb: ExpressionBuilder<DB, 'puntsObservacio'>) =>
  [
    'id',
    'slug',
    'nom',
    'municipi',
    'descripcio',
    'altitud',
    'horitzoObert',
    'accessibilitat',
    'sqm',
    'estat',
    'origen',
    'dataCreacio',
    'dataActualitzacio',
    lon(eb.ref('ubicacio')).as('lon'),
    lat(eb.ref('ubicacio')).as('lat'),
  ] as const;

type Fila = {
  id: string;
  slug: string;
  nom: string;
  municipi: string;
  descripcio: string;
  altitud: number | null;
  horitzoObert: string[] | null;
  accessibilitat: string | null;
  sqm: string | null;
  estat: PuntAdmin['estat'];
  origen: PuntAdmin['origen'];
  dataCreacio: Date;
  dataActualitzacio: Date;
  lon: number;
  lat: number;
};

function toPuntAdmin(fila: Fila): PuntAdmin {
  return {
    ...fila,
    // La restricció de la taula només admet aquestes direccions.
    horitzoObert: fila.horitzoObert as DireccioHoritzo[] | null,
    // `numeric` arriba com a text per no perdre precisió; amb 2 decimals, un number n'hi ha prou.
    sqm: fila.sqm === null ? null : Number(fila.sqm),
    dataCreacio: new Date(fila.dataCreacio).toISOString(),
    dataActualitzacio: new Date(fila.dataActualitzacio).toISOString(),
  };
}

export function createPuntsAdminRepository(db: Db): PuntsAdminRepository {
  return {
    async list() {
      const files = await db
        .selectFrom('puntsObservacio')
        .select(columnes)
        .orderBy('slug')
        .execute();
      return files.map(toPuntAdmin);
    },

    async find(id) {
      const fila = await db
        .selectFrom('puntsObservacio')
        .select(columnes)
        .where('id', '=', id)
        .executeTakeFirst();
      return fila && toPuntAdmin(fila);
    },

    async create({ lat: novaLat, lon: novaLon, ...punt }) {
      const fila = await db
        .insertInto('puntsObservacio')
        .values({
          slug: punt.slug,
          nom: punt.nom,
          municipi: punt.municipi,
          descripcio: punt.descripcio,
          altitud: punt.altitud ?? null,
          horitzoObert: punt.horitzoObert ?? null,
          accessibilitat: punt.accessibilitat ?? null,
          // Sense `sqm`, la fórmula de l'índex hi posa la foscor estimada i ho marca (ADR-0020).
          sqm: punt.sqm ?? null,
          origen: 'OFICIAL',
          estat: punt.estat,
          ubicacio: puntDesDeLonLat(novaLon, novaLat),
        })
        .onConflict((oc) => oc.column('slug').doNothing())
        .returning(columnes)
        .executeTakeFirst();
      return fila && toPuntAdmin(fila);
    },

    async update(id, { lat: novaLat, lon: novaLon, ...canvis }) {
      const fila = await db
        .updateTable('puntsObservacio')
        .set((eb) => {
          const set: UpdateObject<DB, 'puntsObservacio'> = { ...canvis };
          if (novaLat === undefined || novaLon === undefined) return set;
          // A l'SQL, la dreta del `set` llegeix la fila d'abans del canvi.
          const nova = puntDesDeLonLat(novaLon, novaLat);
          const mateixLloc = dinsRadi(eb.ref('ubicacio'), nova, MATEIX_LLOC_M);
          const siNoEsMou = <C extends 'horitzo' | 'estacioXema' | 'sqm'>(columna: C) =>
            sql<
              Selectable<DB['puntsObservacio']>[C]
            >`case when ${mateixLloc} then ${eb.ref(columna)} else null end`;
          set.ubicacio = nova;
          set.horitzo = siNoEsMou('horitzo');
          set.estacioXema = siNoEsMou('estacioXema');
          if (canvis.sqm === undefined) set.sqm = siNoEsMou('sqm');
          return set;
        })
        .where('id', '=', id)
        .returning(columnes)
        .executeTakeFirst();
      return fila && toPuntAdmin(fila);
    },
  };
}
