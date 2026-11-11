import type { IndexMapa, PuntObservacio } from './punts';

/**
 * Un punt dels favorits de l'usuari autenticat (HU25–HU27, taula `favorits`, TG-169): el que
 * necessita una fila de la llista del perfil (TG-171). Només el veu qui l'ha desat. Com
 * `Recomanacio`, és el punt amb uns quants camps de més: `id` és el del punt (un favorit no en té
 * cap de propi), el que obre la fitxa (`GET /api/v1/punts/{id}`) i el que es passa a
 * `DELETE /api/v1/favorits/{puntId}`.
 */
export type Favorit = PuntObservacio & {
  /**
   * Índex de l'hora en curs, com al mapa (`GET /api/v1/punts`). `null` si el worker encara no
   * l'ha calculat.
   */
  index: IndexMapa | null;
  /** Quan l'usuari el va desar als favorits, ISO 8601. */
  dataCreacio: string;
};

/** Cos de `POST /api/v1/favorits`. No porta cap usuari: l'API el treu del JWT. */
export type FavoritNou = {
  /** Un punt publicat (`PuntObservacio.id`). */
  puntId: string;
};
