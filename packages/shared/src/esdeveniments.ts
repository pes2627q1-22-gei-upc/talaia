/** Tipus de fenomen publicats al servei acordat amb Aprop (P14, TG-109). */
export type TipusFenomen = 'pluja_estels' | 'eclipsi_solar' | 'eclipsi_llunar';

export type IdiomaEsdeveniment = 'ca' | 'es' | 'en';

/** Punt general recomanat perquè Aprop pugui situar l'esdeveniment al seu mapa. */
export type UbicacioEsdeveniment = {
  nom: string;
  latitud: number;
  longitud: number;
};

/**
 * Ocurrència concreta d'un fenomen astronòmic (`GET /api/v1/esdeveniments`).
 * Contracte acordat amb Aprop a TG-109. Les dates són ISO 8601 en UTC.
 */
export type Esdeveniment = {
  id: string;
  tipus: TipusFenomen;
  nom: string;
  inici: string;
  fi: string;
  /** Moment de màxima visibilitat, si la font en publica un. */
  maxim: string | null;
  descripcio: string;
  ubicacio: UbicacioEsdeveniment;
  /** Origen de la dada (`IMO`, `NASA`, càlcul propi). */
  font: string;
};

export type EsdevenimentsResponse = {
  data: Esdeveniment[];
};
