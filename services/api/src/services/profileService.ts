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
  ensureProfile: (user: AuthenticatedUser) => Promise<{ created: boolean; profile: ProfileRecord }>;
};

type Db = ReturnType<typeof createDb>;

/** Perfils a la base de dades. Rep el pool de `server.ts`, el mateix que fan servir els punts. */
export function createDatabaseProfileStore(db: Db): ProfileStore {
  return {
    async ensureProfile(user) {
      const avatarUrl =
        typeof user.userMetadata?.avatar_url === 'string' ? user.userMetadata.avatar_url : null;
      const nomComplet =
        typeof user.userMetadata?.full_name === 'string' ? user.userMetadata.full_name : null;
      const nomDefault = user.email ? user.email.split('@')[0] : null;

      const inserted = await db
        .insertInto('perfils')
        .values({
          authUserId: user.id,
          email: user.email ?? null,
          nom: nomComplet ?? nomDefault,
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
  };
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
