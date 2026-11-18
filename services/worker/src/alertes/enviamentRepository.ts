import type { DB } from '@talaia/db';
import { sql, type Kysely } from 'kysely';

import type { EnviamentRepository } from './enviament';

/** L'enviament de les notificacions amb Kysely (ADR-0013, TG-154). */
export function createKyselyEnviamentRepository(db: Kysely<DB>): EnviamentRepository {
  return {
    async pending(desDe) {
      const files = await db
        .selectFrom('notificacionsAlertes as n')
        .innerJoin('alertes as a', 'a.id', 'n.alertaId')
        .innerJoin('perfils as pf', 'pf.id', 'a.perfilId')
        .innerJoin('puntsObservacio as p', 'p.id', 'n.puntId')
        .select([
          'n.alertaId',
          // `pg` llegeix un `date` a la mitjanit local del procés: millor com a text (ADR-0033).
          sql<string>`n.nit::text`.as('nit'),
          'a.perfilId',
          'n.puntId',
          'p.nom as puntNom',
          'n.hora',
          'n.index',
        ])
        .where('n.enviadaEl', 'is', null)
        .where('n.hora', '>=', desDe)
        // Si mentrestant s'ha desactivat l'alerta, s'ha bloquejat el compte o s'ha retirat el
        // punt, ja no s'envia.
        .where('a.activa', '=', true)
        .where('pf.bloquejat', '=', false)
        .where('p.estat', '=', 'PUBLICAT')
        .orderBy('n.alertaId')
        .orderBy('n.nit')
        .execute();
      return files.map((f) => ({ ...f, hora: f.hora.toISOString() }));
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

    async markSent({ alertaId, nit }, ticketIds, enviadaEl) {
      await db
        .updateTable('notificacionsAlertes')
        .set({ enviadaEl, ticketIds })
        .where('alertaId', '=', alertaId)
        .where('nit', '=', sql<Date>`cast(${nit} as date)`)
        .execute();
    },

    async deleteTokens(tokens) {
      if (tokens.length === 0) return;
      await db.deleteFrom('dispositiusPush').where('token', 'in', tokens).execute();
    },
  };
}
