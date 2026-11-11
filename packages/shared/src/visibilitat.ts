import type { IndexHora } from './indexVisibilitat';

/** Paràmetres de `GET /api/v1/visibilitat` (HU05): un lloc qualsevol de Catalunya i una hora. */
export type ConsultaVisibilitat = {
  /** Graus WGS84. */
  lat: number;
  lon: number;
  /** Instant ISO 8601 amb zona; compta l'hora que el conté. Absent: l'hora en curs. */
  hora?: string;
};

/**
 * `GET /api/v1/visibilitat`: l'índex d'una ubicació escollida al mapa, calculat al moment per a
 * una hora (HU05, ADR-0031). Els factors són els mateixos que a la fitxa d'un punt (HU04).
 */
export type VisibilitatUbicacio = {
  /** On s'ha calculat: la ubicació consultada, arrodonida a 0,01° (~1 km). Graus WGS84. */
  lat: number;
  lon: number;
  /**
   * Foscor del cel que s'ha fet servir (SQM, mag/arcsec²): la del punt publicat més proper, si
   * n'hi ha un a 5 km o menys. `null` si no: la foscor és estimada (`index.foscorEstimada`).
   */
  sqm: number | null;
  /** L'índex de l'hora demanada (inici de l'hora, UTC), amb els factors. */
  index: IndexHora;
  /** El Sol encara no s'ha post (factor `sol` 0): l'índex val 0 per l'hora, no pel cel. */
  deDia: boolean;
};
