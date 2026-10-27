import { puntDesDeLonLat, type DB } from '@talaia/db';
import type { LecturaXema } from '@talaia/shared';
import { sql, type Kysely } from 'kysely';

import type { XemaRepository } from './ingesta';
import type { EstacioXema, VariableXema } from './xema';

/** Files per `insert`: lluny del límit de 65.535 paràmetres de Postgres (9 columnes per fila). */
const FILES_PER_INSERT = 1000;

const COLUMNES = [
  'temperatura',
  'humitat',
  'precipitacio',
  'vent_velocitat',
  'vent_direccio',
  'irradiancia',
] as const;

/**
 * Una fila és validada si tots els valors que porta ho són. En una ingesta parcial es conserven
 * valors antics (`coalesce`): si se'n conserva algun, també cal que l'antiga fos validada.
 */
const VALIDADA = sql<boolean>`excluded.validada and (lectures_xema.validada or not (${sql.join(
  COLUMNES.map(
    (c) => sql`(excluded.${sql.ref(c)} is null and lectures_xema.${sql.ref(c)} is not null)`,
  ),
  sql` or `,
)}))`;

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
              operativa: true,
            })),
          )
          .onConflict((oc) =>
            oc.column('codi').doUpdateSet((eb) => ({
              nom: eb.ref('excluded.nom'),
              ubicacio: eb.ref('excluded.ubicacio'),
              altitud: eb.ref('excluded.altitud'),
              operativa: true,
              actualitzadaEl: new Date(),
            })),
          )
          .execute();
        // No s'esborra: n'hi ha prou d'un dia de baixa temporal per perdre l'historial (TG-184).
        await trx
          .updateTable('estacionsXema')
          .set({ operativa: false, actualitzadaEl: new Date() })
          .where('operativa', '=', true)
          .where(
            'codi',
            'not in',
            estacions.map((e) => e.codi),
          )
          .execute();
      });
    },

    async assignaEstacionsProperes() {
      // `<->` entre geographies ordena per distància amb l'índex GiST (KNN de PostGIS). Només es
      // toquen els punts que canvien, perquè el trigger no els renovi `data_actualitzacio`.
      const mesPropera = sql<string | null>`(
        select e.codi from estacions_xema e
        where e.operativa
        order by e.ubicacio <-> punts_observacio.ubicacio
        limit 1
      )`;
      await db
        .updateTable('puntsObservacio')
        .set({ estacioXema: mesPropera })
        .where(sql<boolean>`estacio_xema is distinct from ${mesPropera}`)
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
              validada: VALIDADA,
            }),
          )
          .execute();
      }
    },

    async ultimaLectura() {
      const fila = await db
        .selectFrom('lecturesXema')
        .select((eb) => eb.fn.max('data').as('data'))
        .executeTakeFirst();
      return fila?.data ? new Date(fila.data).toISOString() : null;
    },

    async esborraLecturesAnteriors(abans) {
      await db.deleteFrom('lecturesXema').where('data', '<', abans).execute();
    },

    async anulaValors(valors) {
      // Una actualització per variable; les columnes es diuen com les variables (`LecturaXema`).
      const perVariable = new Map<VariableXema, typeof valors>();
      for (const v of valors)
        perVariable.set(v.variable, [...(perVariable.get(v.variable) ?? []), v]);
      for (const [variable, files] of perVariable) {
        await db
          .updateTable('lecturesXema')
          .set({ [variable]: null })
          .where(
            sql<boolean>`(estacio, data) in (${sql.join(
              files.map((f) => sql`(${f.estacio}, ${f.data}::timestamptz)`),
            )})`,
          )
          .execute();
      }
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

type PuntAmbCoordenades = { id: string; lat: number; lon: number };

/**
 * En memòria, per als tests i la CLI. Amb `punts`, `assignaEstacionsProperes` tria l'estació
 * operativa més propera de debò; amb `estacions`, les estacions dels punts són aquestes.
 */
export function createInMemoryXemaRepository({
  punts = [],
  estacions: estacionsFixes,
}: { punts?: PuntAmbCoordenades[]; estacions?: string[] } = {}) {
  const estacions = new Map<string, EstacioXema & { operativa: boolean }>();
  const assignades = new Map<string, string>();
  const lectures = new Map<string, LecturaXema>();

  const repository: XemaRepository & {
    lectures(): LecturaXema[];
    estacions(): Array<EstacioXema & { operativa: boolean }>;
    estacioDe(puntId: string): string | undefined;
  } = {
    async desaEstacions(noves) {
      // Com el de Kysely: una resposta buida de Meteocat no deixa cap estació com a no operativa.
      if (noves.length === 0) return;
      for (const e of estacions.values()) e.operativa = false;
      for (const e of noves) estacions.set(e.codi, { ...e, operativa: true });
    },
    async assignaEstacionsProperes() {
      const operatives = [...estacions.values()].filter((e) => e.operativa);
      for (const p of punts) {
        const [mesPropera] = [...operatives].sort((a, b) => distancia(p, a) - distancia(p, b));
        if (mesPropera) assignades.set(p.id, mesPropera.codi);
        else assignades.delete(p.id);
      }
      return assignades.size;
    },
    async estacionsDelsPunts() {
      return estacionsFixes ?? [...new Set(assignades.values())];
    },
    async desaLectures(noves) {
      for (const l of noves) {
        const clau = `${l.estacio}|${l.data}`;
        const anterior = lectures.get(clau);
        lectures.set(clau, anterior ? fusiona(anterior, l) : l);
      }
    },
    async ultimaLectura() {
      const dates = [...lectures.values()].map((l) => Date.parse(l.data));
      return dates.length ? new Date(Math.max(...dates)).toISOString() : null;
    },
    async esborraLecturesAnteriors(abans) {
      for (const [clau, l] of lectures)
        if (Date.parse(l.data) < abans.getTime()) lectures.delete(clau);
    },
    async anulaValors(valors) {
      for (const { estacio, data, variable } of valors) {
        const fila = lectures.get(`${estacio}|${data}`);
        if (fila) fila[variable] = null;
      }
    },
    lectures: () => [...lectures.values()],
    estacions: () => [...estacions.values()],
    estacioDe: (puntId) => assignades.get(puntId),
  };
  return repository;
}

/** Prou per ordenar estacions a Catalunya: distància equirectangular en graus. */
function distancia(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dx = (a.lon - b.lon) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(dx, a.lat - b.lat);
}

/** El mateix que l'upsert: els valors nous, els antics on el nou és `null`, i `validada` igual. */
function fusiona(anterior: LecturaXema, nova: LecturaXema): LecturaXema {
  const valors = {
    temperatura: nova.temperatura ?? anterior.temperatura,
    humitat: nova.humitat ?? anterior.humitat,
    precipitacio: nova.precipitacio ?? anterior.precipitacio,
    ventVelocitat: nova.ventVelocitat ?? anterior.ventVelocitat,
    ventDireccio: nova.ventDireccio ?? anterior.ventDireccio,
    irradiancia: nova.irradiancia ?? anterior.irradiancia,
  };
  const conservaAntics = (Object.keys(valors) as Array<keyof typeof valors>).some(
    (k) => nova[k] === null && anterior[k] !== null,
  );
  return {
    ...nova,
    ...valors,
    validada: nova.validada && (anterior.validada || !conservaAntics),
  };
}
