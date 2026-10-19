import { puntDesDeLonLat, type DB } from '@talaia/db';
import type { LecturaXema } from '@talaia/shared';
import { sql, type Kysely } from 'kysely';

import type { XemaRepository } from './ingesta';

/** Files per `insert`: lluny del límit de 65.535 paràmetres de Postgres (9 columnes per fila). */
const FILES_PER_INSERT = 1000;

/** Les taules de la XEMA (TG-115) amb Kysely (ADR-0013). */
export function createKyselyXemaRepository(db: Kysely<DB>): XemaRepository {
  return {
    async desaEstacions(estacions) {
      if (estacions.length === 0) return;
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto('estacionsXema')
          .values(
            estacions.map((e) => ({
              codi: e.codi,
              nom: e.nom,
              ubicacio: puntDesDeLonLat(e.lon, e.lat),
              altitud: e.altitud,
            })),
          )
          .onConflict((oc) =>
            oc.column('codi').doUpdateSet((eb) => ({
              nom: eb.ref('excluded.nom'),
              ubicacio: eb.ref('excluded.ubicacio'),
              altitud: eb.ref('excluded.altitud'),
              actualitzadaEl: new Date(),
            })),
          )
          .execute();
        // Una estació que ja no és operativa no ha de quedar com a la més propera de cap punt.
        await trx
          .deleteFrom('estacionsXema')
          .where(
            'codi',
            'not in',
            estacions.map((e) => e.codi),
          )
          .execute();
      });
    },

    async assignaEstacionsProperes() {
      // `<->` entre geographies ordena per distància amb l'índex GiST (KNN de PostGIS).
      await db
        .updateTable('puntsObservacio')
        .set((eb) => ({
          estacioXema: eb
            .selectFrom('estacionsXema as e')
            .select('e.codi')
            .orderBy(sql`e.ubicacio <-> punts_observacio.ubicacio`)
            .limit(1),
        }))
        .execute();
      const { n } = await db
        .selectFrom('puntsObservacio')
        .select((eb) => eb.fn.count<string>('estacioXema').as('n'))
        .executeTakeFirstOrThrow();
      return Number(n);
    },

    async estacionsDelsPunts() {
      const files = await db
        .selectFrom('puntsObservacio')
        .select('estacioXema')
        .distinct()
        .where('estacioXema', 'is not', null)
        .execute();
      return files.flatMap((f) => (f.estacioXema ? [f.estacioXema] : []));
    },

    async desaLectures(lectures) {
      for (let i = 0; i < lectures.length; i += FILES_PER_INSERT) {
        await db
          .insertInto('lecturesXema')
          .values(lectures.slice(i, i + FILES_PER_INSERT).map(fila))
          .onConflict((oc) =>
            oc.columns(['estacio', 'data']).doUpdateSet({
              // Una ingesta parcial (una variable que ha fallat) no esborra el que ja hi havia.
              temperatura: sql`coalesce(excluded.temperatura, lectures_xema.temperatura)`,
              humitat: sql`coalesce(excluded.humitat, lectures_xema.humitat)`,
              precipitacio: sql`coalesce(excluded.precipitacio, lectures_xema.precipitacio)`,
              ventVelocitat: sql`coalesce(excluded.vent_velocitat, lectures_xema.vent_velocitat)`,
              ventDireccio: sql`coalesce(excluded.vent_direccio, lectures_xema.vent_direccio)`,
              irradiancia: sql`coalesce(excluded.irradiancia, lectures_xema.irradiancia)`,
              validada: sql`excluded.validada`,
            }),
          )
          .execute();
      }
    },

    async esborraLecturesAnteriors(abans) {
      await db.deleteFrom('lecturesXema').where('data', '<', abans).execute();
    },
  };
}

const fila = (l: LecturaXema) => ({
  estacio: l.estacio,
  data: l.data,
  temperatura: l.temperatura,
  humitat: l.humitat,
  precipitacio: l.precipitacio,
  ventVelocitat: l.ventVelocitat,
  ventDireccio: l.ventDireccio,
  irradiancia: l.irradiancia,
  validada: l.validada,
});

/** En memòria, per als tests i la CLI. */
export function createInMemoryXemaRepository(estacionsDelsPunts: string[] = []) {
  const estacions = new Map<string, unknown>();
  const lectures = new Map<string, LecturaXema>();
  const repository: XemaRepository & { lectures(): LecturaXema[] } = {
    async desaEstacions(noves) {
      estacions.clear();
      for (const e of noves) estacions.set(e.codi, e);
    },
    async assignaEstacionsProperes() {
      return estacionsDelsPunts.length;
    },
    async estacionsDelsPunts() {
      return estacionsDelsPunts;
    },
    async desaLectures(noves) {
      for (const l of noves) {
        const clau = `${l.estacio}|${l.data}`;
        const anterior = lectures.get(clau);
        lectures.set(clau, anterior ? fusiona(anterior, l) : l);
      }
    },
    async esborraLecturesAnteriors(abans) {
      for (const [clau, l] of lectures)
        if (Date.parse(l.data) < abans.getTime()) lectures.delete(clau);
    },
    lectures: () => [...lectures.values()],
  };
  return repository;
}

/** El mateix que el `coalesce` de l'upsert: els valors nous, i els antics on el nou és `null`. */
function fusiona(anterior: LecturaXema, nova: LecturaXema): LecturaXema {
  return {
    ...nova,
    temperatura: nova.temperatura ?? anterior.temperatura,
    humitat: nova.humitat ?? anterior.humitat,
    precipitacio: nova.precipitacio ?? anterior.precipitacio,
    ventVelocitat: nova.ventVelocitat ?? anterior.ventVelocitat,
    ventDireccio: nova.ventDireccio ?? anterior.ventDireccio,
    irradiancia: nova.irradiancia ?? anterior.irradiancia,
  };
}
