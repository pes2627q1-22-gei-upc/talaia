import { fakeDb } from '../../testing/fakeDb';
import { createSqmRepository } from '../sqmRepository';

describe('sqmRepository.sqmProper', () => {
  it('busca el punt publicat amb SQM més proper dins del radi', async () => {
    const { db, queries } = fakeDb();

    await createSqmRepository(db).sqmProper({ lat: 41.95, lon: 1.52 }, 5_000);

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toBe(
      'select "sqm", st_distance("ubicacio", st_setsrid(st_makepoint($1, $2), 4326)::geography) as "distancia_m" from "punts_observacio" where "estat" = $3 and "sqm" is not null and st_dwithin("ubicacio", st_setsrid(st_makepoint($4, $5), 4326)::geography, $6) order by "distancia_m" limit $7',
    );
    expect(queries[0]?.parameters).toEqual([1.52, 41.95, 'PUBLICAT', 1.52, 41.95, 5_000, 1]);
  });

  it('converteix el numeric (text) a number', async () => {
    const { db } = fakeDb([{ sqm: '21.56', distancia_m: 1234.5 }]);
    await expect(createSqmRepository(db).sqmProper({ lat: 42.02, lon: 0.74 }, 5_000)).resolves.toBe(
      21.56,
    );
  });

  it('sense cap punt a prop, null (foscor estimada)', async () => {
    const { db } = fakeDb([]);
    await expect(
      createSqmRepository(db).sqmProper({ lat: 41.95, lon: 1.52 }, 5_000),
    ).resolves.toBeNull();
  });
});
