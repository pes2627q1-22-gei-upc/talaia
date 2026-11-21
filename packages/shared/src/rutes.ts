/** Modes de transport que pot retornar el servei de rutes de Mobilicat. */
export const MODES_RUTA = ['WALK', 'BIKE', 'BIKE_SHARE', 'CAR', 'PUBLIC_TRANSPORT'] as const;
export type ModeRuta = (typeof MODES_RUTA)[number];

/** Informació mínima d'un tram per identificar els modes d'una alternativa. */
export type TramRuta = {
  sequence: number;
  mode: ModeRuta;
  transitMode?: string;
  lineShortName?: string | null;
  lineLongName?: string | null;
  agencyName?: string | null;
};

/** Resum d'una alternativa, amb els totals que calcula Mobilicat per a la ruta sencera. */
export type AlternativaRuta = {
  sortida: string;
  arribada: string;
  duradaSegons: number;
  distanciaMetres: number;
  transbordaments: number;
  trams: TramRuta[];
};

/** `GET /api/v1/punts/{id}/rutes`: el fall d'un proveïdor no amaga la fitxa del punt. */
export type RutesPunt = {
  estat: 'disponible' | 'sense_rutes' | 'no_disponible';
  /** Primera alternativa de Mobilicat (arribada més aviat amb `DEPART_AT`), o `null` si no n'hi ha. */
  destacada: AlternativaRuta | null;
  /** Fins a cinc alternatives en l'ordre que ha retornat Mobilicat. */
  alternatives: AlternativaRuta[];
};
