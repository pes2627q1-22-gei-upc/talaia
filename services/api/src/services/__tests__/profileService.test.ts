import type { AuthenticatedUser } from '../../middleware/auth';
import { fakeDb } from '../../testing/fakeDb';
import { createDatabaseProfileStore } from '../profileService';

/** L'usuari tal com el deixa `requireAuth` a partir d'un JWT de Google. */
const MARIA: AuthenticatedUser = {
  id: 'f3c1b2a0-5d6e-4f70-8a9b-1c2d3e4f5a6b',
  email: 'maria@example.com',
  role: 'authenticated',
  userMetadata: { full_name: 'Maria Puig', avatar_url: 'https://example.com/maria.png' },
};

/** Una fila de `perfils` tal com la retorna `pg`: snake_case i dates com a `Date`. */
const FILA = {
  id: 'perfil-1',
  auth_user_id: MARIA.id,
  email: 'maria@example.com',
  nom: 'Maria Puig',
  avatar_url: 'https://example.com/maria.png',
  data_creacio: new Date('2026-10-14T12:00:00.000Z'),
  data_actualitzacio: new Date('2026-10-14T12:00:00.000Z'),
};

const PERFIL = {
  id: 'perfil-1',
  authUserId: MARIA.id,
  email: 'maria@example.com',
  nom: 'Maria Puig',
  avatarUrl: 'https://example.com/maria.png',
  dataCreacio: new Date('2026-10-14T12:00:00.000Z'),
  dataActualitzacio: new Date('2026-10-14T12:00:00.000Z'),
};

describe('createDatabaseProfileStore.ensureProfile', () => {
  it('insereix el perfil sense trepitjar-ne un que ja hi sigui (on conflict do nothing)', async () => {
    const { db, queries } = fakeDb([FILA]);

    await createDatabaseProfileStore(db).ensureProfile(MARIA);

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'insert into "perfils" ("auth_user_id", "email", "nom", "avatar_url") values ($1, $2, $3, $4) on conflict ("auth_user_id") do nothing returning *',
    );
    expect(queries[0]?.parameters).toEqual([
      MARIA.id,
      'maria@example.com',
      'Maria Puig',
      'https://example.com/maria.png',
    ]);
  });

  it('el primer accés crea el perfil (created: true) amb una sola consulta', async () => {
    const { db, queries } = fakeDb([FILA]);

    await expect(createDatabaseProfileStore(db).ensureProfile(MARIA)).resolves.toEqual({
      created: true,
      profile: PERFIL,
    });
    expect(queries).toHaveLength(1);
  });

  it('si el perfil ja existia, el llegeix per auth_user_id (created: false)', async () => {
    // L'insert no retorna cap fila (ja hi era); el select sí.
    const { db, queries } = fakeDb([[], [FILA]]);

    await expect(createDatabaseProfileStore(db).ensureProfile(MARIA)).resolves.toEqual({
      created: false,
      profile: PERFIL,
    });
    expect(queries).toHaveLength(2);
    expect(queries[1]?.sql).toBe('select * from "perfils" where "auth_user_id" = $1');
    expect(queries[1]?.parameters).toEqual([MARIA.id]);
  });

  it("falla si ni s'ha pogut inserir ni es troba: no inventa cap perfil", async () => {
    const { db } = fakeDb([]);
    await expect(createDatabaseProfileStore(db).ensureProfile(MARIA)).rejects.toThrow();
  });

  describe('el nom del perfil nou', () => {
    const nomInserit = async (user: AuthenticatedUser, hints?: { nom?: string }) => {
      const { db, queries } = fakeDb([FILA]);
      await createDatabaseProfileStore(db).ensureProfile(user, hints);
      return queries[0]?.parameters[2];
    };

    it("primer el que envia l'app (Apple no el posa al token)", async () => {
      expect(await nomInserit(MARIA, { nom: 'Martina Maldonado' })).toBe('Martina Maldonado');
    });

    it('després el full_name del token (Google)', async () => {
      expect(await nomInserit(MARIA, {})).toBe('Maria Puig');
    });

    it('si no, la part local del correu', async () => {
      expect(await nomInserit({ ...MARIA, userMetadata: {} })).toBe('maria');
      expect(await nomInserit({ ...MARIA, userMetadata: { full_name: 42 } })).toBe('maria');
    });

    it('i sense correu, cap nom', async () => {
      expect(await nomInserit({ id: MARIA.id, role: 'authenticated' })).toBeNull();
      expect(await nomInserit({ id: MARIA.id, email: null, role: 'authenticated' })).toBeNull();
    });
  });

  it("només agafa l'avatar si el token el porta com a cadena", async () => {
    const avatarInserit = async (user: AuthenticatedUser) => {
      const { db, queries } = fakeDb([FILA]);
      await createDatabaseProfileStore(db).ensureProfile(user);
      return queries[0]?.parameters[3];
    };
    expect(await avatarInserit(MARIA)).toBe('https://example.com/maria.png');
    expect(await avatarInserit({ ...MARIA, userMetadata: undefined })).toBeNull();
    expect(await avatarInserit({ ...MARIA, userMetadata: { avatar_url: null } })).toBeNull();
    // L'usuari pot escriure les seves metadades: res que no sigui un enllaç https.
    expect(
      await avatarInserit({ ...MARIA, userMetadata: { avatar_url: 'javascript:alert(1)' } }),
    ).toBeNull();
    expect(
      await avatarInserit({ ...MARIA, userMetadata: { avatar_url: 'http://example.com/a.png' } }),
    ).toBeNull();
    expect(
      await avatarInserit({ ...MARIA, userMetadata: { avatar_url: 'no és un enllaç' } }),
    ).toBeNull();
  });

  it('retalla el full_name del token a 100 caràcters, com el nom de POST /perfil', async () => {
    const { db, queries } = fakeDb([FILA]);
    await createDatabaseProfileStore(db).ensureProfile({
      ...MARIA,
      userMetadata: { full_name: `  ${'a'.repeat(300)}  ` },
    });
    expect(queries[0]?.parameters[2]).toBe('a'.repeat(100));
  });

  it('tolera files amb les dates com a text i els camps opcionals buits', async () => {
    const { db } = fakeDb([
      {
        id: 7,
        auth_user_id: MARIA.id,
        email: null,
        nom: null,
        avatar_url: undefined,
        data_creacio: '2026-10-14T12:00:00.000Z',
        data_actualitzacio: '2026-10-15T08:30:00.000Z',
      },
    ]);

    const { profile } = await createDatabaseProfileStore(db).ensureProfile(MARIA);

    expect(profile).toEqual({
      id: '7',
      authUserId: MARIA.id,
      email: null,
      nom: null,
      avatarUrl: null,
      dataCreacio: new Date('2026-10-14T12:00:00.000Z'),
      dataActualitzacio: new Date('2026-10-15T08:30:00.000Z'),
    });
  });
});
