import { dinsRadi, distancia, type DB } from '@talaia/db';
import type { ObjectiuObservacio } from '@talaia/shared';
import { sql, type Kysely } from 'kysely';

import type { AlertesRepository } from './avaluacio';

/** L'avaluació de les alertes amb Kysely (ADR-0013, ADR-0033). */
export function createKyselyAlertesRepository(db: Kysely<DB>): AlertesRepository {
  return {
    /**
     * Una sola consulta per a totes les alertes: el radi es compara amb `st_dwithin` sobre
     * `geography` (l'índex GIST de `punts_observacio`) i l'hora, amb la clau d'`index_visibilitat`.
     * Ja deixa fora el que no pot notificar (alertes inactives o ja notificades aquesta nit, hores
     * fora de la finestra, índex per sota del mínim o 0); la decisió és de `pickNotifications`.
     */
    async candidates({ nit, from, to }) {
      const files = await db
        .selectFrom('alertes as a')
        .innerJoin('puntsObservacio as p', (join) =>
          join
            .on('p.estat', '=', 'PUBLICAT')
            .on((eb) =>
              dinsRadi(
                eb.ref('a.origen'),
                eb.ref('p.ubicacio'),
                sql<number>`${eb.ref('a.distanciaMaxKm')} * 1000`,
              ),
            ),
        )
        // A la v1 l'índex és el mateix per a tots els objectius (ADR-0018). Quan
        // `index_visibilitat` tingui la columna `objectiu` (ADR-0027, TG-184), aquí s'hi afegeix
        // `iv.objectiu = a.objectiu` i la resta de l'avaluació no canvia.
        .innerJoin('indexVisibilitat as iv', 'iv.puntId', 'p.id')
        .select((eb) => [
          'a.id as alertaId',
          'a.perfilId',
          'a.objectiu',
          'a.activa',
          'a.indexMinim',
          'a.distanciaMaxKm',
          'p.id as puntId',
          'p.nom as puntNom',
          distancia(eb.ref('a.origen'), eb.ref('p.ubicacio')).as('distanciaM'),
          'iv.hora',
          'iv.valor as index',
        ])
        .where('a.activa', '=', true)
        .where('iv.hora', '>=', from)
        .where('iv.hora', '<', to)
        .where('iv.valor', '>', 0)
        .whereRef('iv.valor', '>=', 'a.indexMinim')
        .where(({ not, exists, selectFrom }) =>
          not(
            exists(
              selectFrom('notificacionsAlertes as n')
                .select('n.alertaId')
                .whereRef('n.alertaId', '=', 'a.id')
                .where('n.nit', '=', sql<Date>`cast(${nit} as date)`),
            ),
          ),
        )
        .execute();
      return files.map((f) => ({
        alertaId: f.alertaId,
        perfilId: f.perfilId,
        // El `check` d'`alertes` només deixa els valors d'`ObjectiuObservacio`.
        objectiu: f.objectiu as ObjectiuObservacio,
        activa: f.activa,
        indexMinim: f.indexMinim,
        distanciaMaxKm: f.distanciaMaxKm,
        puntId: f.puntId,
        puntNom: f.puntNom,
        // `st_distance` és `double precision`: pg ja el retorna com a number.
        distanciaKm: Number(f.distanciaM) / 1000,
        hora: f.hora.toISOString(),
        index: f.index,
      }));
    },

    async saveNotifications(notificacions) {
      if (notificacions.length === 0) return [];
      // La clau primària (alerta_id, nit) fa la feina: si una altra execució ja n'ha desat una
      // per a la mateixa alerta i nit, aquesta no s'insereix i no torna.
      const noves = await db
        .insertInto('notificacionsAlertes')
        .values(
          notificacions.map(({ alertaId, nit, puntId, hora, index }) => ({
            alertaId,
            nit,
            puntId,
            hora,
            index,
          })),
        )
        .onConflict((oc) => oc.columns(['alertaId', 'nit']).doNothing())
        .returning('alertaId')
        .execute();
      const ids = new Set(noves.map((f) => f.alertaId));
      return notificacions.filter((n) => ids.has(n.alertaId));
    },
  };
}
