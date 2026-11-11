import { lat, lon, type createDb } from '@talaia/db';
import type { Favorit } from '@talaia/shared';

import { indexMapa } from '../punts/puntsRepository';

type Db = ReturnType<typeof createDb>;

/**
 * Favorits d'un usuari (HU25–HU27, TG-169). Totes les operacions reben el perfil de l'usuari del
 * JWT (`perfils.id`, el que deixa `requireUser`) i hi filtren a l'SQL: els favorits d'un altre
 * usuari no es poden ni llegir ni tocar (RNF06). Les consultes només s'escriuen aquí (ADR-0013).
 */
export type FavoritsRepository = {
  /**
   * Els favorits del perfil que encara són `PUBLICAT`, els més nous primer, amb l'índex de l'`hora`
   * (inici, en UTC). Els d'un punt retirat no hi surten, però la fila es conserva.
   */
  list(perfilId: string, hora: Date): Promise<Favorit[]>;
  /**
   * Desa el punt als favorits si és `PUBLICAT`: `undefined` si no ho és o no existeix. Si ja hi
   * era, `created: false` i no en canvia la data.
   */
  add(
    perfilId: string,
    puntId: string,
    hora: Date,
  ): Promise<{ created: boolean; favorit: Favorit } | undefined>;
  /** Treu el punt dels favorits. Si no hi era, no fa res. */
  remove(perfilId: string, puntId: string): Promise<void>;
};

export function createFavoritsRepository(db: Db): FavoritsRepository {
  /** Els favorits del perfil amb el punt (només si és publicat) i l'índex de l'`hora`. */
  const favoritsPublicats = (perfilId: string, hora: Date) =>
    db
      .selectFrom('favorits as f')
      .innerJoin('puntsObservacio as p', 'p.id', 'f.puntId')
      .leftJoin('indexVisibilitat as iv', (join) =>
        join.onRef('iv.puntId', '=', 'p.id').on('iv.hora', '=', hora),
      )
      .select((eb) => [
        'p.id',
        'p.nom',
        'p.municipi',
        lon(eb.ref('p.ubicacio')).as('lon'),
        lat(eb.ref('p.ubicacio')).as('lat'),
        'iv.valor',
        'iv.franja',
        'iv.factors',
        'f.dataCreacio',
      ])
      .where('f.perfilId', '=', perfilId)
      .where('p.estat', '=', 'PUBLICAT');

  return {
    async list(perfilId, hora) {
      const files = await favoritsPublicats(perfilId, hora)
        // Amb el punt per desempatar: dos favorits desats en la mateixa transacció tenen la mateixa data.
        .orderBy('f.dataCreacio', 'desc')
        .orderBy('p.id')
        .execute();
      return files.map(toFavorit);
    },

    async add(perfilId, puntId, hora) {
      // Una sola sentència comprova que el punt és publicat i l'insereix: un punt retirat no hi
      // entra mai. Amb `on conflict do nothing`, desar-lo dos cops no fa res (i no retorna cap fila).
      const inserit = await db
        .insertInto('favorits')
        .columns(['perfilId', 'puntId'])
        .expression((eb) =>
          eb
            .selectFrom('puntsObservacio')
            .select((sb) => [sb.val(perfilId).as('perfilId'), 'id'])
            .where('id', '=', puntId)
            .where('estat', '=', 'PUBLICAT'),
        )
        .onConflict((oc) => oc.columns(['perfilId', 'puntId']).doNothing())
        .returning('puntId')
        .executeTakeFirst();
      const fila = await favoritsPublicats(perfilId, hora)
        .where('p.id', '=', puntId)
        .executeTakeFirst();
      return fila ? { created: inserit !== undefined, favorit: toFavorit(fila) } : undefined;
    },

    async remove(perfilId, puntId) {
      await db
        .deleteFrom('favorits')
        .where('perfilId', '=', perfilId)
        .where('puntId', '=', puntId)
        .execute();
    },
  };
}

type FilaFavorit = {
  id: string;
  nom: string;
  municipi: string;
  lon: number;
  lat: number;
  valor: number | null;
  franja: string | null;
  factors: unknown;
  dataCreacio: Date | string;
};

function toFavorit({ valor, franja, factors, dataCreacio, ...punt }: FilaFavorit): Favorit {
  return {
    ...punt,
    index: indexMapa({ valor, franja, factors }),
    dataCreacio: new Date(dataCreacio).toISOString(),
  };
}
