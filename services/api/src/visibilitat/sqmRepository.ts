import { dinsRadi, distancia, lat, lon, puntDesDeLonLat, type createDb } from '@talaia/db';

import type { SqmProper } from './visibilitatService';

type Db = ReturnType<typeof createDb>;

/**
 * La foscor del cel d'una ubicació qualsevol (ADR-0031): el punt publicat amb SQM més proper, si
 * és a `metres` o menys, amb la seva posició perquè el servei sàpiga si és de la mateixa cel·la.
 * El mapa de contaminació lumínica (GeoTIFF, ADR-0020) no és a l'API: el catàleg és l'única font
 * de foscor que té.
 */
export function createSqmRepository(db: Db): { sqmProper: SqmProper } {
  return {
    async sqmProper(lloc, metres) {
      const fila = await db
        .selectFrom('puntsObservacio')
        .select((eb) => [
          'sqm',
          lon(eb.ref('ubicacio')).as('lon'),
          lat(eb.ref('ubicacio')).as('lat'),
          distancia(eb.ref('ubicacio'), puntDesDeLonLat(lloc.lon, lloc.lat)).as('distanciaM'),
        ])
        .where('estat', '=', 'PUBLICAT')
        .where('sqm', 'is not', null)
        .where((eb) => dinsRadi(eb.ref('ubicacio'), puntDesDeLonLat(lloc.lon, lloc.lat), metres))
        .orderBy('distanciaM')
        .limit(1)
        .executeTakeFirst();
      if (fila?.sqm == null) return null;
      // `numeric` arriba com a text per no perdre precisió; amb 2 decimals, un number n'hi ha prou.
      return { sqm: Number(fila.sqm), lat: fila.lat, lon: fila.lon };
    },
  };
}
