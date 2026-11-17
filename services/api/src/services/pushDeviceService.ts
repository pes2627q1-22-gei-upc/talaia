import type { createDb } from '@talaia/db';
import type { DispositiuPush } from '@talaia/shared';

export type PushDeviceStore = {
  /**
   * Desa el token al perfil de l'usuari, o el hi passa si era d'un altre perfil (upsert per
   * `token`). `false` si l'usuari encara no té perfil (l'app no ha fet `POST /perfil`).
   */
  registerDevice: (authUserId: string, device: DispositiuPush) => Promise<boolean>;
  /** Treu el token del perfil de l'usuari. No fa res si no hi era o és d'un altre perfil. */
  removeDevice: (authUserId: string, token: string) => Promise<void>;
};

type Db = ReturnType<typeof createDb>;

/** Tokens de `dispositius_push` (ADR-0028). Rep el pool de `server.ts`. */
export function createDatabasePushDeviceStore(db: Db): PushDeviceStore {
  return {
    async registerDevice(authUserId, { token, plataforma }) {
      // Una sola consulta: el perfil surt del `select`; si no n'hi ha, no s'insereix res.
      // `data_actualitzacio` la posa el trigger de la taula.
      const row = await db
        .insertInto('dispositiusPush')
        .columns(['perfilId', 'token', 'plataforma'])
        .expression((eb) =>
          eb
            .selectFrom('perfils')
            .select((eb) => [
              'perfils.id',
              eb.val(token).as('token'),
              eb.val(plataforma).as('plataforma'),
            ])
            .where('perfils.authUserId', '=', authUserId),
        )
        .onConflict((oc) =>
          oc.column('token').doUpdateSet((eb) => ({
            perfilId: eb.ref('excluded.perfilId'),
            plataforma: eb.ref('excluded.plataforma'),
          })),
        )
        .returning('id')
        .executeTakeFirst();
      return row !== undefined;
    },

    async removeDevice(authUserId, token) {
      await db
        .deleteFrom('dispositiusPush')
        .where('token', '=', token)
        .where('perfilId', 'in', (eb) =>
          eb
            .selectFrom('perfils')
            .select('perfils.id')
            .where('perfils.authUserId', '=', authUserId),
        )
        .execute();
    },
  };
}
