import type { createDb } from '@talaia/db';
import type { Rol } from '@talaia/shared';
import { sql } from 'kysely';

import type { AuthenticatedUser } from '../middleware/auth';

export type ProfileRecord = {
  id: string;
  authUserId: string;
  email: string | null;
  nom: string | null;
  avatarUrl: string | null;
  rol: Rol;
  bloquejat: boolean;
  dataBloqueig: Date | null;
  dataCreacio: Date;
  dataActualitzacio: Date;
};

/** El que `requireAuth` mira a cada petició autenticada: si el compte està bloquejat i si és admin. */
export type AccountStatus = { perfilId: string; rol: Rol; bloquejat: boolean };

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
  /** Rol i bloqueig; `null` si l'usuari encara no té perfil (no està bloquejat ni és admin). */
  getAccountStatus: (authUserId: string) => Promise<AccountStatus | null>;
  /** Tots els perfils, els més nous primer (web d'administració, HU41). */
  listProfiles: () => Promise<ProfileRecord[]>;
  /** Bloqueja o desbloqueja el perfil `perfilId` (`perfils.id`); `null` si no existeix. */
  setBlocked: (perfilId: string, bloquejat: boolean) => Promise<ProfileRecord | null>;
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

    async getAccountStatus(authUserId) {
      const row = await db
        .selectFrom('perfils')
        .select(['id', 'rol', 'bloquejat'])
        .where('authUserId', '=', authUserId)
        .executeTakeFirst();
      return row ? { perfilId: row.id, rol: toRol(row.rol), bloquejat: row.bloquejat } : null;
    },

    async listProfiles() {
      const rows = await db
        .selectFrom('perfils')
        .selectAll()
        .orderBy('dataCreacio', 'desc')
        .execute();
      return rows.map(deserializeProfile);
    },

    async setBlocked(perfilId, bloquejat) {
      // Tornar a bloquejar un compte bloquejat no en canvia la data.
      const row = await db
        .updateTable('perfils')
        .set({
          bloquejat,
          dataBloqueig: bloquejat ? sql<Date>`coalesce(data_bloqueig, now())` : null,
        })
        .where('id', '=', perfilId)
        .returningAll()
        .executeTakeFirst();
      return row ? deserializeProfile(row) : null;
    },
  };
}

/** El `check` de `perfils.rol` només admet aquests dos valors. */
function toRol(value: unknown): Rol {
  return value === 'admin' ? 'admin' : 'usuari';
}

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
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
    rol: toRol(row.rol),
    bloquejat: row.bloquejat === true,
    dataBloqueig: row.dataBloqueig == null ? null : toDate(row.dataBloqueig),
    dataCreacio: toDate(row.dataCreacio),
    dataActualitzacio: toDate(row.dataActualitzacio),
  };
}
