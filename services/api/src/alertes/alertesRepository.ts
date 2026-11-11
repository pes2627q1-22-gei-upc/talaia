import type { Alerta, AlertaNova, ObjectiuObservacio } from '@talaia/shared';
import { lat, lon, puntDesDeLonLat, type createDb } from '@talaia/db';

type Db = ReturnType<typeof createDb>;

/**
 * Alertes d'un perfil (HU16, TG-145). Reben el `perfilId` que `requireUser` llegeix del perfil de
 * l'usuari del JWT (`req.account`), mai un que vingui de la petició, i filtren per ell a l'SQL.
 */
export type AlertesStore = {
  /** Crea l'alerta (activa). */
  create: (perfilId: string, alerta: AlertaNova) => Promise<Alerta>;
  /** Les alertes del perfil, de la més nova a la més antiga. */
  list: (perfilId: string) => Promise<Alerta[]>;
};

export function createDatabaseAlertesStore(db: Db): AlertesStore {
  return {
    async create(perfilId, { objectiu, origen, distanciaMaxKm, indexMinim }) {
      const row = await db
        .insertInto('alertes')
        .values({
          perfilId,
          objectiu,
          origen: puntDesDeLonLat(origen.lon, origen.lat),
          distanciaMaxKm,
          indexMinim,
        })
        .returning((eb) => [
          'id',
          'objectiu',
          lat(eb.ref('origen')).as('lat'),
          lon(eb.ref('origen')).as('lon'),
          'distanciaMaxKm',
          'indexMinim',
          'activa',
          'dataCreacio',
          'dataActualitzacio',
        ])
        .executeTakeFirstOrThrow();
      return toAlerta(row);
    },

    async list(perfilId) {
      const rows = await db
        .selectFrom('alertes')
        .select((eb) => [
          'id',
          'objectiu',
          lat(eb.ref('origen')).as('lat'),
          lon(eb.ref('origen')).as('lon'),
          'distanciaMaxKm',
          'indexMinim',
          'activa',
          'dataCreacio',
          'dataActualitzacio',
        ])
        .where('perfilId', '=', perfilId)
        // Amb `id` per desempatar: dues alertes creades en la mateixa transacció tenen la mateixa data.
        .orderBy('dataCreacio', 'desc')
        .orderBy('id')
        .execute();
      return rows.map(toAlerta);
    },
  };
}

type AlertaRow = {
  id: string;
  objectiu: string;
  lat: number;
  lon: number;
  distanciaMaxKm: number;
  indexMinim: number;
  activa: boolean;
  dataCreacio: Date | string;
  dataActualitzacio: Date | string;
};

function toAlerta(row: AlertaRow): Alerta {
  return {
    id: row.id,
    // El `check` de la taula només deixa els valors d'`ObjectiuObservacio`.
    objectiu: row.objectiu as ObjectiuObservacio,
    origen: { lat: Number(row.lat), lon: Number(row.lon) },
    distanciaMaxKm: Number(row.distanciaMaxKm),
    indexMinim: Number(row.indexMinim),
    activa: row.activa,
    dataCreacio: new Date(row.dataCreacio).toISOString(),
    dataActualitzacio: new Date(row.dataActualitzacio).toISOString(),
  };
}
