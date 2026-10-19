import { lat, lon, type createDb } from '@talaia/db';
import type { PuntObservacio } from '@talaia/shared';

type Db = ReturnType<typeof createDb>;

/** Accés als punts d'observació (ADR-0013): les consultes només s'escriuen aquí. */
export type PuntsRepository = {
  /** Punts visibles al mapa: només els que tenen `estat = 'PUBLICAT'`. */
  listPublished(): Promise<PuntObservacio[]>;
};

export function createPuntsRepository(db: Db): PuntsRepository {
  return {
    listPublished: () =>
      db
        .selectFrom('puntsObservacio')
        .select((eb) => [
          'id',
          'nom',
          'municipi',
          lon(eb.ref('ubicacio')).as('lon'),
          lat(eb.ref('ubicacio')).as('lat'),
        ])
        .where('estat', '=', 'PUBLICAT')
        .orderBy('slug')
        .execute(),
  };
}
