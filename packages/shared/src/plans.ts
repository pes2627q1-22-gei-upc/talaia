/**
 * Un pla d'observació de l'usuari autenticat (HU12, taula `plans`, TG-156): un punt, opcionalment
 * un esdeveniment del calendari, i una data i hora. Només el veu qui l'ha creat. Dates en ISO 8601
 * (UTC).
 */
export type Pla = {
  id: string;
  /** El punt del pla, amb el nom en l'idioma de l'usuari (`Accept-Language`). */
  punt: {
    id: string;
    nom: string;
    municipi: string;
    /**
     * `false` si el punt s'ha retirat després de crear el pla: el pla es conserva, però la fitxa
     * (`GET /api/v1/punts/{id}`) ja no hi és.
     */
    publicat: boolean;
  };
  /** L'`id` de `GET /api/v1/esdeveniments/{id}`; `null` si el pla no va lligat a cap fenomen. */
  esdevenimentId: string | null;
  dataHoraInici: string;
  /** Final de la franja (TG-240); `null` si no se n'ha triat. */
  dataHoraFi: string | null;
  /** Id de l'esdeveniment al calendari del mòbil (TG-158); `null` si no s'hi ha afegit. */
  calendariEventId: string | null;
  notes: string | null;
  dataCreacio: string;
  dataActualitzacio: string;
};

/** Cos de `POST /api/v1/plans`. No porta cap usuari: l'API el treu del JWT. */
export type PlaNou = {
  /** Un punt publicat (`PuntObservacio.id`). */
  puntId: string;
  esdevenimentId?: string | null;
  /** ISO 8601 amb zona (`Z` o `+01:00`). */
  dataHoraInici: string;
  /** Posterior a `dataHoraInici`. */
  dataHoraFi?: string | null;
  calendariEventId?: string | null;
  notes?: string | null;
};

/** `?quan=` de `GET /api/v1/plans` (TG-160). */
export type QuanPlans = 'futurs' | 'passats';
