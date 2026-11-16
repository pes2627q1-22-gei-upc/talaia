import type { createDb } from '@talaia/db';
import type { Pla, PlaNou, QuanPlans } from '@talaia/shared';

type Db = ReturnType<typeof createDb>;

/** Un pla amb els textos traduïts del punt (TG-164): el servei en tria el nom de l'idioma. */
export type PlaAmbTextos = Omit<Pla, 'punt'> & { punt: Pla['punt'] & { textos?: unknown } };

/**
 * `punt_not_found`: el punt no existeix o no és `PUBLICAT`. `event_not_found`: s'ha enviat un
 * `esdevenimentId` que no existeix.
 */
export type CreatePlaResult =
  { ok: true; pla: PlaAmbTextos } | { ok: false; reason: 'punt_not_found' | 'event_not_found' };

/**
 * Plans d'un usuari (HU12, TG-156). Totes les operacions reben el perfil de l'usuari del JWT
 * (`perfils.id`, el que deixa `requireUser`) i hi filtren a l'SQL: els plans d'un altre usuari no es
 * poden ni llegir ni tocar (RNF06). Les consultes només s'escriuen aquí (ADR-0013).
 */
export type PlansRepository = {
  /** Crea el pla si el punt és publicat i, si n'hi ha, l'esdeveniment existeix. */
  create(perfilId: string, pla: PlaNou): Promise<CreatePlaResult>;
  /**
   * Els plans del perfil. Un pla és futur mentre no s'ha acabat (`dataHoraFi`, o `dataHoraInici` si
   * no en té) respecte a `ara`. Els futurs i tots plegats, del més proper al més llunyà; els passats,
   * del més recent al més antic. Els d'un punt retirat també hi surten.
   */
  list(perfilId: string, quan: QuanPlans | undefined, ara: Date): Promise<PlaAmbTextos[]>;
  /** El pla, si és del perfil; `undefined` si no existeix o és d'un altre usuari. */
  findById(perfilId: string, id: string): Promise<PlaAmbTextos | undefined>;
};

export function createPlansRepository(db: Db): PlansRepository {
  /**
   * Els plans del perfil amb el seu punt. Sense filtrar per l'estat del punt: el pla d'un punt
   * retirat no ha de desaparèixer (TG-161 i TG-174 hi tornaran).
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
    async create(perfilId, pla) {
      return db.transaction().execute(async (trx) => {
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
          const esdeveniment = await trx
            .selectFrom('esdevenimentsAstronomics')
            .select('codi')
            .where('codi', '=', pla.esdevenimentId)
            .forShare()
            .executeTakeFirst();
          if (!esdeveniment) return { ok: false, reason: 'event_not_found' } as const;
        }

        const { id } = await trx
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
          .returning('id')
          .executeTakeFirstOrThrow();

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
        query = query.where(
          (eb) => eb.fn.coalesce('pl.dataHoraFi', 'pl.dataHoraInici'),
          quan === 'futurs' ? '>=' : '<',
          ara,
        );
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
