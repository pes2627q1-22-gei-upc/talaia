import { lat, lon, type DB } from '@talaia/db';
import { sql, type Kysely } from 'kysely';

import { createKyselyIndexRepository } from '../index/repository';
import type { RecalculDeps } from './recalcul';

/** Els ports del recàlcul sobre la base de dades (ADR-0013). */
export function createKyselyRecalculRepositories(
  db: Kysely<DB>,
): Pick<RecalculDeps, 'punts' | 'indexs' | 'execucions'> {
  return {
    punts: {
      async listPublicats() {
        const files = await db
          .selectFrom('puntsObservacio')
          .leftJoin('estacionsXema as e', 'e.codi', 'puntsObservacio.estacioXema')
          .select((eb) => [
            'puntsObservacio.id',
            'puntsObservacio.altitud',
            'puntsObservacio.sqm',
            'puntsObservacio.horitzo',
            'e.codi as estacioCodi',
            'e.altitud as estacioAltitud',
            'e.biaixHumitat',
            'e.biaixCalculatEl',
            lon(eb.ref('puntsObservacio.ubicacio')).as('lon'),
            lat(eb.ref('puntsObservacio.ubicacio')).as('lat'),
            // Amb el `leftJoin` la ubicació pot ser `null`: els helpers no ho tipen, però `estacioCodi`
            // ja diu si n'hi ha.
            lon(sql<string>`e.ubicacio`).as('estacioLon'),
            lat(sql<string>`e.ubicacio`).as('estacioLat'),
          ])
          .where('puntsObservacio.estat', '=', 'PUBLICAT')
          .orderBy('puntsObservacio.slug')
          .execute();
        return files.map((f) => ({
          id: f.id,
          lat: f.lat,
          lon: f.lon,
          altitud: f.altitud,
          // `numeric` arriba com a cadena: el client de Postgres no el converteix per no perdre precisió.
          sqm: f.sqm === null ? null : Number(f.sqm),
          horitzo: f.horitzo,
          estacio:
            f.estacioCodi === null
              ? null
              : {
                  lat: f.estacioLat,
                  lon: f.estacioLon,
                  altitud: f.estacioAltitud,
                  biaixHumitat: f.biaixHumitat,
                  biaixCalculatEl: f.biaixCalculatEl ? new Date(f.biaixCalculatEl) : null,
                },
        }));
      },
    },
    indexs: {
      ...createKyselyIndexRepository(db),
      async esborraAnteriors(abans) {
        await db.deleteFrom('indexVisibilitat').where('hora', '<', abans).execute();
      },
    },
    execucions: {
      async registra(e) {
        await db
          .insertInto('execucionsWorker')
          .values({
            iniciadaEl: e.iniciadaEl,
            acabadaEl: e.acabadaEl,
            estat: e.estat,
            punts: e.punts,
            hores: e.hores,
            error: e.error ?? null,
            notificacions: e.notificacions ?? null,
            errorAlertes: e.errorAlertes ?? null,
          })
          .execute();
      },
    },
  };
}
