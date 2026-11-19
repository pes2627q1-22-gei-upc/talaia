import type { DB } from '@talaia/db';
import { sql, type Kysely } from 'kysely';

import type { EnviamentRepository } from './enviament';

/** L'enviament de les notificacions amb Kysely (ADR-0013, TG-154). */
export function createKyselyEnviamentRepository(db: Kysely<DB>): EnviamentRepository {
  const delaNit = (nit: string) => sql<Date>`cast(${nit} as date)`;

  return {
    /**
     * Un sol `update … from … returning`: Postgres bloqueja cada fila que actualitza, i un segon
     * procés que la volgués reservar alhora espera i, en tornar a mirar `enviada_el is null`, la
     * salta. Així, cap fila no es reserva dues vegades.
     */
    async claim(desDe, reservadaEl) {
      const files = await db
        .updateTable('notificacionsAlertes as n')
        .from(['alertes as a', 'perfils as pf', 'puntsObservacio as p', 'indexVisibilitat as iv'])
        .set({ enviadaEl: reservadaEl })
        .whereRef('a.id', '=', 'n.alertaId')
        .whereRef('pf.id', '=', 'a.perfilId')
        .whereRef('p.id', '=', 'n.puntId')
        .whereRef('iv.puntId', '=', 'n.puntId')
        .whereRef('iv.hora', '=', 'n.hora')
        .where('n.enviadaEl', 'is', null)
        .where('n.hora', '>=', desDe)
        // Si mentrestant s'ha desactivat l'alerta, s'ha bloquejat el compte, s'ha retirat el punt
        // o la previsió (o el mínim) ha canviat i ja no hi arriba, no s'envia.
        .where('a.activa', '=', true)
        .where('pf.bloquejat', '=', false)
        .where('p.estat', '=', 'PUBLICAT')
        .where('iv.valor', '>', 0)
        .whereRef('iv.valor', '>=', 'a.indexMinim')
        .returning([
          'n.alertaId',
          // `pg` llegeix un `date` a la mitjanit local del procés: millor com a text (ADR-0033).
          sql<string>`n.nit::text`.as('nit'),
          'a.perfilId',
          'n.puntId',
          'p.nom as puntNom',
          'n.hora',
          // L'índex actual, el que veurà l'usuari en obrir la fitxa.
          'iv.valor as index',
        ])
        .execute();
      return files
        .map((f) => ({ ...f, hora: f.hora.toISOString() }))
        .sort((a, b) => a.alertaId.localeCompare(b.alertaId) || a.nit.localeCompare(b.nit));
    },

    async tokens(perfilIds) {
      if (perfilIds.length === 0) return [];
      return db
        .selectFrom('dispositiusPush')
        .select(['perfilId', 'token'])
        .where('perfilId', 'in', perfilIds)
        .orderBy('token')
        .execute();
    },

    async saveTickets({ alertaId, nit }, ticketIds) {
      await db
        .updateTable('notificacionsAlertes')
        .set({ ticketIds })
        .where('alertaId', '=', alertaId)
        .where('nit', '=', delaNit(nit))
        .execute();
    },

    async release({ alertaId, nit }, reservadaEl) {
      // Només la reserva pròpia: si una altra execució ja l'ha tornada a agafar, no es toca.
      await db
        .updateTable('notificacionsAlertes')
        .set({ enviadaEl: null })
        .where('alertaId', '=', alertaId)
        .where('nit', '=', delaNit(nit))
        .where('enviadaEl', '=', reservadaEl)
        .execute();
    },

    async deleteTokens(tokens) {
      if (tokens.length === 0) return;
      await db.deleteFrom('dispositiusPush').where('token', 'in', tokens).execute();
    },
  };
}
