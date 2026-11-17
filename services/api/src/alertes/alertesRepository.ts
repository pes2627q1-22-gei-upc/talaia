import type { Alerta, AlertaCanvis, AlertaNova, ObjectiuObservacio } from '@talaia/shared';
import { lat, lon, puntDesDeLonLat, type createDb } from '@talaia/db';

type Db = ReturnType<typeof createDb>;

/**
 * Màxim d'alertes per usuari. El worker de notificacions (TG-153) les avalua totes cada hora:
 * sense límit, un sol compte el podria alentir.
 */
export const MAX_ALERTES = 20;

export type CreateAlertaResult = { ok: true; alerta: Alerta } | { ok: false; reason: 'limit' };

/**
 * `not_found`: cap alerta amb aquest `id` del perfil (tampoc si és d'un altre usuari).
 * `quan_avisa`: amb els canvis, l'alerta no avisaria mai (`avisaEnArribar` fals i `horaAvis` null).
 */
export type UpdateAlertaResult =
  { ok: true; alerta: Alerta } | { ok: false; reason: 'not_found' | 'quan_avisa' };

/**
 * Alertes d'un perfil (HU16, TG-145). Reben el `perfilId` que `requireUser` llegeix del perfil de
 * l'usuari del JWT (`req.account`), mai un que vingui de la petició, i filtren per ell a l'SQL.
 */
export type AlertesStore = {
  /** Crea l'alerta (activa), si el perfil encara no en té `MAX_ALERTES`. */
  create: (perfilId: string, alerta: AlertaNova) => Promise<CreateAlertaResult>;
  /** Les alertes del perfil, de la més nova a la més antiga. */
  list: (perfilId: string) => Promise<Alerta[]>;
  /** Aplica els canvis a una alerta del perfil (TG-147). */
  update: (perfilId: string, id: string, canvis: AlertaCanvis) => Promise<UpdateAlertaResult>;
};

const COLUMNES = [
  'id',
  'objectiu',
  'distanciaMaxKm',
  'indexMinim',
  'avisaEnArribar',
  'horaAvis',
  'activa',
  'dataCreacio',
  'dataActualitzacio',
] as const;

export function createDatabaseAlertesStore(db: Db): AlertesStore {
  return {
    async create(
      perfilId,
      { objectiu, origen, distanciaMaxKm, indexMinim, avisaEnArribar, horaAvis },
    ) {
      return db.transaction().execute(async (trx) => {
        // Bloqueja el perfil fins al final de la transacció: dues peticions alhora del mateix
        // usuari es fan una darrere l'altra i no poden passar totes dues el límit.
        await trx
          .selectFrom('perfils')
          .select('id')
          .where('id', '=', perfilId)
          .forUpdate()
          .executeTakeFirst();

        const { total } = await trx
          .selectFrom('alertes')
          .select((eb) => eb.fn.countAll<string>().as('total'))
          .where('perfilId', '=', perfilId)
          .executeTakeFirstOrThrow();
        if (Number(total) >= MAX_ALERTES) return { ok: false, reason: 'limit' } as const;

        const row = await trx
          .insertInto('alertes')
          .values({
            perfilId,
            objectiu,
            origen: puntDesDeLonLat(origen.lon, origen.lat),
            distanciaMaxKm,
            indexMinim,
            avisaEnArribar,
            horaAvis,
          })
          .returning((eb) => [
            ...COLUMNES,
            lat(eb.ref('origen')).as('lat'),
            lon(eb.ref('origen')).as('lon'),
          ])
          .executeTakeFirstOrThrow();
        return { ok: true, alerta: toAlerta(row) } as const;
      });
    },

    async list(perfilId) {
      const rows = await db
        .selectFrom('alertes')
        .select((eb) => [
          ...COLUMNES,
          lat(eb.ref('origen')).as('lat'),
          lon(eb.ref('origen')).as('lon'),
        ])
        .where('perfilId', '=', perfilId)
        // Amb `id` per desempatar: dues alertes creades en la mateixa transacció tenen la mateixa data.
        .orderBy('dataCreacio', 'desc')
        .orderBy('id')
        .execute();
      return rows.map(toAlerta);
    },

    async update(perfilId, id, { origen, ...canvis }) {
      return db.transaction().execute(async (trx) => {
        // Bloqueja la fila: la regla de «quan avisa» es comprova amb els valors que hi haurà
        // després del canvi, i dues peticions alhora no la poden saltar.
        const actual = await trx
          .selectFrom('alertes')
          .select(['avisaEnArribar', 'horaAvis'])
          .where('id', '=', id)
          .where('perfilId', '=', perfilId)
          .forUpdate()
          .executeTakeFirst();
        if (!actual) return { ok: false, reason: 'not_found' } as const;

        const avisaEnArribar = canvis.avisaEnArribar ?? actual.avisaEnArribar;
        const horaAvis = canvis.horaAvis === undefined ? actual.horaAvis : canvis.horaAvis;
        if (!avisaEnArribar && horaAvis === null)
          return { ok: false, reason: 'quan_avisa' } as const;

        const row = await trx
          .updateTable('alertes')
          .set({
            ...canvis,
            ...(origen ? { origen: puntDesDeLonLat(origen.lon, origen.lat) } : {}),
          })
          .where('id', '=', id)
          .where('perfilId', '=', perfilId)
          .returning((eb) => [
            ...COLUMNES,
            lat(eb.ref('origen')).as('lat'),
            lon(eb.ref('origen')).as('lon'),
          ])
          .executeTakeFirstOrThrow();
        return { ok: true, alerta: toAlerta(row) } as const;
      });
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
  avisaEnArribar: boolean;
  horaAvis: number | null;
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
    avisaEnArribar: row.avisaEnArribar,
    horaAvis: row.horaAvis === null ? null : Number(row.horaAvis),
    activa: row.activa,
    dataCreacio: new Date(row.dataCreacio).toISOString(),
    dataActualitzacio: new Date(row.dataActualitzacio).toISOString(),
  };
}
