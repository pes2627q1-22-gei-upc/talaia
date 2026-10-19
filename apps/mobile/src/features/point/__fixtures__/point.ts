import type { IndexHora, PuntFitxa } from '@talaia/shared';

import type { PointDetailModel } from '../pointModel';

/** Dades de prova: no s'importen mai des de l'app. */
export const hour: IndexHora = {
  hora: '2026-10-18T21:00:00Z',
  valor: 87,
  franja: 'ras',
  factors: { nuvols: 0.95, sol: 1, foscor: 0.94, lluna: 0.68 },
  foscorEstimada: false,
};
export const point: PointDetailModel = {
  id: 'montsec',
  nom: 'Serra del Montsec',
  municipi: 'Àger',
  lat: 42.05,
  lon: 0.73,
  descripcio: 'Punt de prova amb horitzó obert.',
  accessibilitat: 'Aparcament al costat del punt.',
  horitzoObert: ['S', 'SW'],
  altitud: 1570,
  indexActual: { ...hour, hora: '2026-10-18T20:00:00Z' },
  properesHores: [
    { ...hour, hora: '2026-10-18T23:00:00Z', valor: 94 },
    hour,
    { ...hour, hora: '2026-10-18T22:00:00Z', valor: 35, franja: 'tap' },
  ],
};

/** Mateixa fitxa amb la forma JSON de `GET /punts/{id}` (TG-92). */
export function asPointResponse(detail: PointDetailModel = point): PuntFitxa {
  return {
    id: detail.id,
    nom: detail.nom,
    municipi: detail.municipi,
    lat: detail.lat,
    lon: detail.lon,
    descripcio: detail.descripcio,
    altitud: detail.altitud,
    accessibilitat: detail.accessibilitat,
    horitzoObert: detail.horitzoObert,
    sqm: 21.4,
    index: { actual: detail.indexActual, properesHores: detail.properesHores },
  };
}
