import type { createDb } from '@talaia/db';

import type { AuthenticatedUser } from '../middleware/auth';

export type ProfileRecord = {
  id: string;
  authUserId: string;
  email: string | null;
  nom: string | null;
  avatarUrl: string | null;
  dataCreacio: Date;
  dataActualitzacio: Date;
};

export type ProfileStore = {
  ensureProfile: (
    user: AuthenticatedUser,
    /** El nom que envia l'app (Apple no el posa al token). */
    hints?: { nom?: string },
  ) => Promise<{ created: boolean; profile: ProfileRecord }>;
  /** El perfil de l'usuari, o `null` si encara no n'hi ha (l'app no ha fet `POST /perfil`). */
  getProfile: (authUserId: string) => Promise<ProfileRecord | null>;
  /** Canvia el nom; `null` si l'usuari no té perfil. */
  updateProfile: (authUserId: string, changes: { nom: string }) => Promise<ProfileRecord | null>;
};

type Db = ReturnType<typeof createDb>;

/** Perfils a la base de dades. Rep el pool de `server.ts`, el mateix que fan servir els punts. */
export function createDatabaseProfileStore(db: Db): ProfileStore {
  return {
    async ensureProfile(user, hints) {
      // `user_metadata` el pot escriure l'usuari mateix (`auth.updateUser`): només un avatar
      // https i un nom de com a molt 100 caràcters, com el que valida `POST /perfil`.
      const avatarUrl = httpsUrl(user.userMetadata?.avatar_url);
      const nomComplet =
        typeof user.userMetadata?.full_name === 'string'
          ? user.userMetadata.full_name.trim().slice(0, NOM_MAXIM) || null
          : null;
      const nomDefault = user.email ? user.email.split('@')[0] : null;

      const inserted = await db
        .insertInto('perfils')
        .values({
          authUserId: user.id,
          email: user.email ?? null,
          nom: hints?.nom ?? nomComplet ?? nomDefault,
          avatarUrl,
        })
        .onConflict((oc) => oc.column('authUserId').doNothing())
        .returningAll()
        .executeTakeFirst();

      if (inserted) {
        return { created: true, profile: deserializeProfile(inserted) };
      }

      const existing = await db
        .selectFrom('perfils')
        .selectAll()
        .where('authUserId', '=', user.id)
        .executeTakeFirstOrThrow();

      return { created: false, profile: deserializeProfile(existing) };
    },

    async getProfile(authUserId) {
      const row = await db
        .selectFrom('perfils')
        .selectAll()
        .where('authUserId', '=', authUserId)
        .executeTakeFirst();
      return row ? deserializeProfile(row) : null;
    },

    async updateProfile(authUserId, { nom }) {
      // `data_actualitzacio` la posa el trigger de la taula.
      const row = await db
        .updateTable('perfils')
        .set({ nom })
        .where('authUserId', '=', authUserId)
        .returningAll()
        .executeTakeFirst();
      return row ? deserializeProfile(row) : null;
    },
  };
}

/** Llargada màxima del nom, la mateixa en crear el perfil (`POST`) i en editar-lo (`PATCH`). */
export const NOM_MAXIM = 100;

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

function deserializeProfile(row: Record<string, unknown>): ProfileRecord {
  return {
    id: String(row.id),
    authUserId: String(row.authUserId),
    email: typeof row.email === 'string' ? row.email : null,
    nom: typeof row.nom === 'string' ? row.nom : null,
    avatarUrl: typeof row.avatarUrl === 'string' ? row.avatarUrl : null,
    dataCreacio:
      row.dataCreacio instanceof Date ? row.dataCreacio : new Date(String(row.dataCreacio)),
    dataActualitzacio:
      row.dataActualitzacio instanceof Date
        ? row.dataActualitzacio
        : new Date(String(row.dataActualitzacio)),
  };
}
