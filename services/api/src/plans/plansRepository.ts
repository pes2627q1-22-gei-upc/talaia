import type { DB, createDb } from '@talaia/db';
import type { Pla, PlaCanvis, PlaNou, QuanPlans } from '@talaia/shared';
import { sql, type ExpressionBuilder } from 'kysely';

import { esdevenimentsPublics } from '../esdeveniments/esdevenimentsRepository';
import { TIME_ZONE } from '../index/night';

type Db = ReturnType<typeof createDb>;

/**
 * Màxim de plans futurs (sense acabar) per usuari, com el de les alertes. Els passats no hi
 * compten: un usuari no s'ha de quedar sense poder planificar per haver-ne fet molts.
 */
export const MAX_PLANS_FUTURS = 20;

/**
 * Quan s'acaba un pla: `data_hora_fi` o, si no en té, el final de la nit que conté l'inici (les
 * 12:00 locals de l'endemà de la nit, com `nightWindow(defaultNight(inici)).to` de
 * `index/night.ts`). Així un pla «aquesta nit a les 21:00» sense hora de final continua sent futur
 * mentre s'observa. La nit d'un inici és el dia local de `inici − 12 h`, igual que `defaultNight`.
 */
export function fiEfectiu(eb: ExpressionBuilder<{ pl: DB['plans'] }, 'pl'>) {
  const inici = eb.ref('pl.dataHoraInici');
  return eb.fn.coalesce(
    eb.ref('pl.dataHoraFi'),
    sql<Date>`(((${inici} at time zone ${TIME_ZONE}) - interval '12 hours')::date + 1 + time '12:00') at time zone ${TIME_ZONE}`,
  );
}

/** Un pla amb els textos traduïts del punt (TG-164): el servei en tria el nom de l'idioma. */
export type PlaAmbTextos = Omit<Pla, 'punt'> & { punt: Pla['punt'] & { textos?: unknown } };

/**
 * `punt_not_found`: el punt no existeix o no és `PUBLICAT`. `event_not_found`: s'ha enviat un
 * `esdevenimentId` que `GET /esdeveniments/{id}` no retorna. `limit`: l'usuari ja té
 * `MAX_PLANS_FUTURS` plans sense acabar. `duplicate`: ja té un pla al mateix punt i a la mateixa hora
 * d'inici (per exemple, un doble toc a «Crea el pla»).
 */
export type CreatePlaResult =
  | { ok: true; pla: PlaAmbTextos }
  | { ok: false; reason: 'punt_not_found' | 'event_not_found' | 'limit' | 'duplicate' };

/**
 * `not_found`: el pla no existeix o és d'un altre usuari. `punt_not_found` i `event_not_found`: el
 * punt o el fenomen del pla resultant (el que ja tenia, si no es canvien) no és publicat o públic.
 * `duplicate`: el pla resultant coincideix en punt i hora amb un altre pla de l'usuari.
 */
export type UpdatePlaResult =
  | { ok: true; pla: PlaAmbTextos }
  | { ok: false; reason: 'not_found' | 'punt_not_found' | 'event_not_found' | 'duplicate' };

/** Violació d'un índex únic de Postgres (`plans_perfil_punt_inici_key`). */
const isUniqueViolation = (err: unknown) =>
  typeof err === 'object' && err !== null && 'code' in err && err.code === '23505';

/**
 * Plans d'un usuari (HU12, TG-156). Totes les operacions reben el perfil de l'usuari del JWT
 * (`perfils.id`, el que deixa `requireUser`) i hi filtren a l'SQL: els plans d'un altre usuari no es
 * poden ni llegir ni tocar (RNF06). Les consultes només s'escriuen aquí (ADR-0013).
 */
export type PlansRepository = {
  /**
   * Crea el pla si el punt és publicat, l'esdeveniment (si n'hi ha) és públic, l'usuari no ha arribat
   * al límit de plans futurs a `ara` i no en té cap altre al mateix punt i hora.
   */
  create(perfilId: string, pla: PlaNou, ara: Date): Promise<CreatePlaResult>;
  /**
   * Els plans del perfil. Un pla és futur mentre no s'ha acabat (`fiEfectiu`: `dataHoraFi` o, si no
   * en té, el final de la nit de l'inici) respecte a `ara`. Els futurs i tots plegats, del més proper al més llunyà; els passats,
   * del més recent al més antic. Els d'un punt retirat també hi surten.
   */
  list(perfilId: string, quan: QuanPlans | undefined, ara: Date): Promise<PlaAmbTextos[]>;
  /** El pla, si és del perfil; `undefined` si no existeix o és d'un altre usuari. */
  findById(perfilId: string, id: string): Promise<PlaAmbTextos | undefined>;
  /** Només actualitza el vincle al calendari d’un pla propi; false si no existeix. */
  setCalendarEvent(perfilId: string, id: string, eventId: string): Promise<boolean>;
  /**
   * Aplica `canvis` (només els camps presents) al pla del perfil (HU14, TG-161), en una transacció
   * que bloqueja el pla: comprova el punt, el fenomen i els duplicats sobre el pla resultant. Les
   * regles de temps (pla acabat, inici al passat, final posterior) les comprova el servei.
   */
  update(perfilId: string, id: string, canvis: PlaCanvis): Promise<UpdatePlaResult>;
};

export function createPlansRepository(db: Db): PlansRepository {
  /**
   * Els plans del perfil amb el seu punt. Sense filtrar per l'estat del punt: el pla d'un punt
   * retirat no ha de desaparèixer: a l'edició (TG-161) se'n tria un altre.
   */
  const plansDelPerfil = (conn: Db, perfilId: string) =>
    conn
      .selectFrom('plans as pl')
      .innerJoin('puntsObservacio as p', 'p.id', 'pl.puntId')
      .select([
        'pl.id',
        'p.id as puntId',
        'p.nom as puntNom',
        'p.municipi as puntMunicipi',
        'p.textos as puntTextos',
        'p.estat as puntEstat',
        'pl.esdevenimentId',
        'pl.dataHoraInici',
        'pl.dataHoraFi',
        'pl.calendariEventId',
        'pl.notes',
        'pl.dataCreacio',
        'pl.dataActualitzacio',
      ])
      .where('pl.perfilId', '=', perfilId);

  return {
    async create(perfilId, pla, ara) {
      return db.transaction().execute(async (trx) => {
        // Bloqueja el perfil: dues creacions alhora (un doble toc) no poden passar totes dues el
        // límit ni el control de duplicats.
        await trx
          .selectFrom('perfils')
          .select('id')
          .where('id', '=', perfilId)
          .forUpdate()
          .executeTakeFirst();

        // `for share`: ni el punt es pot retirar ni l'esdeveniment esborrar fins que s'insereix.
        const punt = await trx
          .selectFrom('puntsObservacio')
          .select('id')
          .where('id', '=', pla.puntId)
          .where('estat', '=', 'PUBLICAT')
          .forShare()
          .executeTakeFirst();
        if (!punt) return { ok: false, reason: 'punt_not_found' } as const;

        if (pla.esdevenimentId) {
          // Els mateixos filtres que `GET /esdeveniments/{id}`: si no, la #140 respondria 404
          // `event_not_found` amb l'`esdevenimentId` del pla.
          const esdeveniment = await esdevenimentsPublics(trx)
            .select('e.codi')
            .where('e.codi', '=', pla.esdevenimentId)
            .forShare()
            .executeTakeFirst();
          if (!esdeveniment) return { ok: false, reason: 'event_not_found' } as const;
        }

        const { total } = await trx
          .selectFrom('plans as pl')
          .select((eb) => eb.fn.countAll<string>().as('total'))
          .where('pl.perfilId', '=', perfilId)
          .where(fiEfectiu, '>=', ara)
          .executeTakeFirstOrThrow();
        if (Number(total) >= MAX_PLANS_FUTURS) return { ok: false, reason: 'limit' } as const;

        const inserit = await trx
          .insertInto('plans')
          .values({
            perfilId,
            puntId: pla.puntId,
            esdevenimentId: pla.esdevenimentId ?? null,
            dataHoraInici: new Date(pla.dataHoraInici),
            dataHoraFi: pla.dataHoraFi ? new Date(pla.dataHoraFi) : null,
            calendariEventId: pla.calendariEventId ?? null,
            notes: pla.notes ?? null,
          })
          // `plans_perfil_punt_inici_key`: el mateix punt i la mateixa hora és el mateix pla.
          .onConflict((oc) => oc.columns(['perfilId', 'puntId', 'dataHoraInici']).doNothing())
          .returning('id')
          .executeTakeFirst();
        if (!inserit) return { ok: false, reason: 'duplicate' } as const;
        const { id } = inserit;

        // El mateix `Pla` que el GET, amb el punt: l'app no ha de tornar-lo a demanar (TG-157).
        const fila = await plansDelPerfil(trx, perfilId)
          .where('pl.id', '=', id)
          .executeTakeFirstOrThrow();
        return { ok: true, pla: toPla(fila) } as const;
      });
    },

    async list(perfilId, quan, ara) {
      let query = plansDelPerfil(db, perfilId);
      if (quan) {
        query = query.where(fiEfectiu, quan === 'futurs' ? '>=' : '<', ara);
      }
      const files = await query
        .orderBy('pl.dataHoraInici', quan === 'passats' ? 'desc' : 'asc')
        // Amb `id` per desempatar: dos plans a la mateixa hora.
        .orderBy('pl.id')
        .execute();
      return files.map(toPla);
    },

    async findById(perfilId, id) {
      const fila = await plansDelPerfil(db, perfilId).where('pl.id', '=', id).executeTakeFirst();
      return fila && toPla(fila);
    },

    async setCalendarEvent(perfilId, id, eventId) {
      const updated = await db
        .updateTable('plans')
        .set({ calendariEventId: eventId })
        .where('perfilId', '=', perfilId)
        .where('id', '=', id)
        .returning('id')
        .executeTakeFirst();
      return updated !== undefined;
    },

    async update(perfilId, id, canvis) {
      try {
        return await db.transaction().execute(async (trx) => {
          // `for update`: dues edicions alhora del mateix pla no es trepitgen les comprovacions.
          const actual = await trx
            .selectFrom('plans')
            .select(['puntId', 'esdevenimentId', 'dataHoraInici'])
            .where('id', '=', id)
            .where('perfilId', '=', perfilId)
            .forUpdate()
            .executeTakeFirst();
          if (!actual) return { ok: false, reason: 'not_found' } as const;

          const puntId = canvis.puntId ?? actual.puntId;
          const esdevenimentId =
            canvis.esdevenimentId === undefined ? actual.esdevenimentId : canvis.esdevenimentId;
          const inici = new Date(canvis.dataHoraInici ?? actual.dataHoraInici);

          // Sempre, encara que el punt no canviï: un pla d'un punt retirat només es pot desar
          // triant-ne un de publicat.
          const punt = await trx
            .selectFrom('puntsObservacio')
            .select('id')
            .where('id', '=', puntId)
            .where('estat', '=', 'PUBLICAT')
            .forShare()
            .executeTakeFirst();
          if (!punt) return { ok: false, reason: 'punt_not_found' } as const;

          if (esdevenimentId) {
            const esdeveniment = await esdevenimentsPublics(trx)
              .select('e.codi')
              .where('e.codi', '=', esdevenimentId)
              .forShare()
              .executeTakeFirst();
            if (!esdeveniment) return { ok: false, reason: 'event_not_found' } as const;
          }

          const duplicat = await trx
            .selectFrom('plans')
            .select('id')
            .where('perfilId', '=', perfilId)
            .where('puntId', '=', puntId)
            .where('dataHoraInici', '=', inici)
            .where('id', '<>', id)
            .executeTakeFirst();
          if (duplicat) return { ok: false, reason: 'duplicate' } as const;

          await trx
            .updateTable('plans')
            .set({
              ...(canvis.puntId !== undefined && { puntId: canvis.puntId }),
              ...(canvis.esdevenimentId !== undefined && { esdevenimentId: canvis.esdevenimentId }),
              ...(canvis.dataHoraInici !== undefined && { dataHoraInici: inici }),
              ...(canvis.dataHoraFi !== undefined && {
                dataHoraFi: canvis.dataHoraFi === null ? null : new Date(canvis.dataHoraFi),
              }),
              ...(canvis.notes !== undefined && { notes: canvis.notes }),
            })
            .where('id', '=', id)
            .where('perfilId', '=', perfilId)
            .returning('id')
            .executeTakeFirstOrThrow();

          // `data_actualitzacio` la posa el trigger `plans_set_data_actualitzacio`.
          const fila = await plansDelPerfil(trx, perfilId)
            .where('pl.id', '=', id)
            .executeTakeFirstOrThrow();
          return { ok: true, pla: toPla(fila) } as const;
        });
      } catch (err) {
        // Una carrera amb un altre pla al mateix punt i hora: l'índex únic l'atura.
        if (isUniqueViolation(err)) return { ok: false, reason: 'duplicate' } as const;
        throw err;
      }
    },
  };
}

type FilaPla = {
  id: string;
  puntId: string;
  puntNom: string;
  puntMunicipi: string;
  puntTextos: unknown;
  puntEstat: string;
  esdevenimentId: string | null;
  dataHoraInici: Date | string;
  dataHoraFi: Date | string | null;
  calendariEventId: string | null;
  notes: string | null;
  dataCreacio: Date | string;
  dataActualitzacio: Date | string;
};

const iso = (data: Date | string) => new Date(data).toISOString();

function toPla(fila: FilaPla): PlaAmbTextos {
  return {
    id: fila.id,
    punt: {
      id: fila.puntId,
      nom: fila.puntNom,
      municipi: fila.puntMunicipi,
      textos: fila.puntTextos,
      publicat: fila.puntEstat === 'PUBLICAT',
    },
    esdevenimentId: fila.esdevenimentId,
    dataHoraInici: iso(fila.dataHoraInici),
    dataHoraFi: fila.dataHoraFi === null ? null : iso(fila.dataHoraFi),
    calendariEventId: fila.calendariEventId,
    notes: fila.notes,
    dataCreacio: iso(fila.dataCreacio),
    dataActualitzacio: iso(fila.dataActualitzacio),
  };
}
