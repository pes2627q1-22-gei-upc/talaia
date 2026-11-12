import {
  dinsRadi,
  estacioXemaMesPropera,
  lat,
  lon,
  puntDesDeLonLat,
  type createDb,
  type DB,
} from '@talaia/db';
import type {
  DireccioHoritzo,
  EstatPuntAdmin,
  PuntAdmin,
  PuntAdminCanvis,
  PuntAdminNou,
} from '@talaia/shared';
import { sql, type ExpressionBuilder, type UpdateObject } from 'kysely';

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
  /**
   * Crea un punt `OFICIAL` sense creador, amb l'estació XEMA més propera; `undefined` si ja hi ha
   * un punt amb aquest `slug`.
   */
  create(punt: PuntAdminNou & { estat: EstatPuntAdmin }): Promise<PuntAdmin | undefined>;
  /**
   * Aplica els canvis en una transacció i torna el punt; `undefined` si no existeix. `comprova`
   * rep el punt tal com és abans del canvi, amb la fila bloquejada: si llança, no es canvia res.
   *
   * Si el punt es mou més de `MATEIX_LLOC_M`, el que depenia del lloc d'abans no es conserva:
   * `horitzo` torna a `null`, `estacio_xema` passa a ser la més propera al lloc nou, `sqm` torna a
   * `null` si els canvis no en porten un de diferent del que hi havia, i s'esborra l'índex que el
   * worker havia calculat (`index_visibilitat`) fins que el torni a calcular.
   */
  update(
    id: string,
    canvis: PuntAdminCanvis,
    comprova?: (actual: PuntAdmin) => void,
  ): Promise<PuntAdmin | undefined>;
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

/** `numeric(4, 2)`: dos valors són el mateix si coincideixen amb 2 decimals. */
function mateixSqm(a: number | null, b: number | null): boolean {
  return a === null || b === null ? a === b : Math.round(a * 100) === Math.round(b * 100);
}

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
          // `null` si encara no hi ha estacions (el worker les carrega en arrencar, ADR-0025).
          estacioXema: estacioXemaMesPropera(puntDesDeLonLat(novaLon, novaLat)),
        })
        .onConflict((oc) => oc.column('slug').doNothing())
        .returning(columnes)
        .executeTakeFirst();
      return fila && toPuntAdmin(fila);
    },

    async update(id, { lat: novaLat, lon: novaLon, ...canvis }, comprova) {
      const nova =
        novaLat === undefined || novaLon === undefined
          ? undefined
          : puntDesDeLonLat(novaLon, novaLat);
      return db.transaction().execute(async (trx) => {
        const actual = await trx
          .selectFrom('puntsObservacio')
          .select((eb) => [
            ...columnes(eb),
            (nova ? dinsRadi(eb.ref('ubicacio'), nova, MATEIX_LLOC_M) : sql<boolean>`true`).as(
              'mateixLloc',
            ),
          ])
          .where('id', '=', id)
          .forUpdate()
          .executeTakeFirst();
        if (!actual) return undefined;
        const { mateixLloc, ...fila } = actual;
        const abans = toPuntAdmin(fila);
        comprova?.(abans);

        const set: UpdateObject<DB, 'puntsObservacio'> = { ...canvis };
        const esMou = nova !== undefined && !mateixLloc;
        if (nova) set.ubicacio = nova;
        if (nova && esMou) {
          set.horitzo = null;
          set.estacioXema = estacioXemaMesPropera(nova);
          // Un formulari que envia el punt sencer hi torna a posar l'sqm del lloc d'abans: si és el
          // mateix que hi havia, no compta com un valor nou.
          if (canvis.sqm === undefined || mateixSqm(canvis.sqm, abans.sqm)) set.sqm = null;
        }
        const nou = await trx
          .updateTable('puntsObservacio')
          .set(set)
          .where('id', '=', id)
          .returning(columnes)
          .executeTakeFirstOrThrow();
        // L'índex era del lloc d'abans: millor cap (marcador gris) que un d'equivocat fins que el
        // worker el torni a calcular, a la propera hora.
        if (esMou) await trx.deleteFrom('indexVisibilitat').where('puntId', '=', id).execute();
        return toPuntAdmin(nou);
      });
    },
  };
}
