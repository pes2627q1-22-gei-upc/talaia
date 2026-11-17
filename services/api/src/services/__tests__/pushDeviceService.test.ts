import { fakeDb } from '../../testing/fakeDb';
import { createDatabasePushDeviceStore } from '../pushDeviceService';

const AUTH_USER = 'f3c1b2a0-5d6e-4f70-8a9b-1c2d3e4f5a6b';
const TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

describe('createDatabasePushDeviceStore.registerDevice', () => {
  it('fa un upsert per token amb el perfil de l’usuari, en una sola consulta', async () => {
    const { db, queries } = fakeDb([{ id: 'dispositiu-1' }]);

    await expect(
      createDatabasePushDeviceStore(db).registerDevice(AUTH_USER, {
        token: TOKEN,
        plataforma: 'android',
      }),
    ).resolves.toBe(true);

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'insert into "dispositius_push" ("perfil_id", "token", "plataforma") select "perfils"."id", $1 as "token", $2 as "plataforma" from "perfils" where "perfils"."auth_user_id" = $3 on conflict ("token") do update set "perfil_id" = "excluded"."perfil_id", "plataforma" = "excluded"."plataforma" returning "id"',
    );
    expect(queries[0]?.parameters).toEqual([TOKEN, 'android', AUTH_USER]);
  });

  it('torna false si l’usuari no té perfil (el select no troba cap fila)', async () => {
    const { db } = fakeDb([]);
    await expect(
      createDatabasePushDeviceStore(db).registerDevice(AUTH_USER, {
        token: TOKEN,
        plataforma: 'ios',
      }),
    ).resolves.toBe(false);
  });
});

describe('createDatabasePushDeviceStore.removeDevice', () => {
  it('només esborra el token si és d’un perfil de l’usuari', async () => {
    const { db, queries } = fakeDb([]);

    await createDatabasePushDeviceStore(db).removeDevice(AUTH_USER, TOKEN);

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'delete from "dispositius_push" where "token" = $1 and "perfil_id" in (select "perfils"."id" from "perfils" where "perfils"."auth_user_id" = $2)',
    );
    expect(queries[0]?.parameters).toEqual([TOKEN, AUTH_USER]);
  });
});
