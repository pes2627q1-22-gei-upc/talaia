import type { Alerta, AlertaNova, ObjectiuObservacio } from '@talaia/shared';
import { lat, lon, puntDesDeLonLat, type createDb } from '@talaia/db';

type Db = ReturnType<typeof createDb>;

/**
 * Alertes de l'usuari autenticat (HU16, TG-145). Totes les operacions reben l'usuari del JWT
 * (`sub`) i filtren per ell a l'SQL: una alerta d'un altre usuari no es pot ni llegir ni tocar.
 */
export type AlertesStore = {
  /** Crea l'alerta (activa). `null` si l'usuari encara no té perfil (cal `POST /perfil`). */
  create: (authUserId: string, alerta: AlertaNova) => Promise<Alerta | null>;
  /** Les alertes de l'usuari, de la més nova a la més antiga. `null` si no té perfil. */
  list: (authUserId: string) => Promise<Alerta[] | null>;
};

export function createDatabaseAlertesStore(db: Db): AlertesStore {
  const perfilId = async (authUserId: string) => {
    const perfil = await db
      .selectFrom('perfils')
      .select('id')
      .where('authUserId', '=', authUserId)
      .executeTakeFirst();
    return perfil?.id ?? null;
  };

  return {
    async create(authUserId, { objectiu, origen, distanciaMaxKm, indexMinim }) {
      const perfil = await perfilId(authUserId);
      if (!perfil) return null;
      const row = await db
        .insertInto('alertes')
        .values({
          perfilId: perfil,
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

    async list(authUserId) {
      const perfil = await perfilId(authUserId);
      if (!perfil) return null;
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
        .where('perfilId', '=', perfil)
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
