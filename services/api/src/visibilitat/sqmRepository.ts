import { dinsRadi, distancia, puntDesDeLonLat, type createDb } from '@talaia/db';

import type { SqmProper } from './visibilitatService';

type Db = ReturnType<typeof createDb>;

/**
 * La foscor del cel d'una ubicació qualsevol (ADR-0031): l'SQM del punt publicat més proper que
 * en té, si és a `metres` o menys. El mapa de contaminació lumínica (GeoTIFF, ADR-0020) no és a
 * l'API: el catàleg és l'única font de foscor que té.
 */
export function createSqmRepository(db: Db): { sqmProper: SqmProper } {
  return {
    async sqmProper({ lat, lon }, metres) {
      const fila = await db
        .selectFrom('puntsObservacio')
        .select((eb) => [
          'sqm',
          distancia(eb.ref('ubicacio'), puntDesDeLonLat(lon, lat)).as('distanciaM'),
        ])
        .where('estat', '=', 'PUBLICAT')
        .where('sqm', 'is not', null)
        .where((eb) => dinsRadi(eb.ref('ubicacio'), puntDesDeLonLat(lon, lat), metres))
        .orderBy('distanciaM')
        .limit(1)
        .executeTakeFirst();
      // `numeric` arriba com a text per no perdre precisió; amb 2 decimals, un number n'hi ha prou.
      return fila?.sqm == null ? null : Number(fila.sqm);
    },
  };
}
