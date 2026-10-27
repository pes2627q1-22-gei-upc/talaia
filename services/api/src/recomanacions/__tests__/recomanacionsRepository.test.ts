import { fakeDb } from '../../testing/fakeDb';
import { createRecomanacionsRepository } from '../recomanacionsRepository';

describe('recomanacionsRepository.puntsDinsRadi', () => {
  it('llegeix els punts publicats dins del radi, del més proper al més llunyà', async () => {
    const { db, queries } = fakeDb();

    await createRecomanacionsRepository(db).puntsDinsRadi({ lat: 41.38, lon: 2.17 }, 115_400);

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'select "id", "nom", "municipi", st_x("ubicacio"::geometry) as "lon", st_y("ubicacio"::geometry) as "lat", st_distance("ubicacio", st_setsrid(st_makepoint($1, $2), 4326)::geography) as "distancia_m" from "punts_observacio" where "estat" = $3 and st_dwithin("ubicacio", st_setsrid(st_makepoint($4, $5), 4326)::geography, $6) order by "distancia_m"',
    );
    expect(queries[0]?.parameters).toEqual([2.17, 41.38, 'PUBLICAT', 2.17, 41.38, 115_400]);
  });

  it('retorna la distància en metres com a number', async () => {
    const fila = {
      id: 'a',
      nom: 'Montsec',
      municipi: 'Àger',
      lon: 0.73,
      lat: 42.02,
      distancia_m: 1234.5,
    };
    const { db } = fakeDb([fila]);

    await expect(
      createRecomanacionsRepository(db).puntsDinsRadi({ lat: 41.38, lon: 2.17 }, 1),
    ).resolves.toEqual([
      { id: 'a', nom: 'Montsec', municipi: 'Àger', lon: 0.73, lat: 42.02, distanciaM: 1234.5 },
    ]);
  });
});

describe('recomanacionsRepository.indexHores', () => {
  const DES_DE = new Date('2026-12-15T21:00:00Z');
  const FINS_A = new Date('2026-12-16T05:00:00Z');

  it("llegeix l'índex dels punts de la franja, per punt i per hora", async () => {
    const { db, queries } = fakeDb();

    await createRecomanacionsRepository(db).indexHores(['a', 'b'], DES_DE, FINS_A);

    expect(queries[0]?.sql).toBe(
      'select "punt_id", "hora", "valor", "franja", "factors", "foscor_estimada" from "index_visibilitat" where "punt_id" in ($1, $2) and "hora" >= $3 and "hora" < $4 order by "punt_id", "hora"',
    );
    expect(queries[0]?.parameters).toEqual(['a', 'b', DES_DE, FINS_A]);
  });

  it('sense punts no fa cap consulta', async () => {
    const { db, queries } = fakeDb();
    await expect(createRecomanacionsRepository(db).indexHores([], DES_DE, FINS_A)).resolves.toEqual(
      [],
    );
    expect(queries).toHaveLength(0);
  });

  it('converteix cada fila a IndexHora amb el punt', async () => {
    const fila = {
      punt_id: 'a',
      hora: DES_DE,
      valor: 82,
      franja: 'ras',
      factors: { nuvols: 1, sol: 1, foscor: 0.9, lluna: 0.7 },
      foscor_estimada: false,
    };
    const { db } = fakeDb([fila]);

    await expect(
      createRecomanacionsRepository(db).indexHores(['a'], DES_DE, FINS_A),
    ).resolves.toEqual([
      {
        puntId: 'a',
        hora: '2026-12-15T21:00:00.000Z',
        valor: 82,
        franja: 'ras',
        factors: { nuvols: 1, sol: 1, foscor: 0.9, lluna: 0.7 },
        foscorEstimada: false,
      },
    ]);
  });
});
