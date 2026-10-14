/**
 * Efemèrides del Sol i de la Lluna per punt, tal com les calcula el worker amb Astronomy Engine
 * (TG-96; ADR-0004: el càlcul es fa dins del servidor, sense API externa). Són l'entrada
 * astronòmica de la fórmula de l'índex (TG-98) i del desglossament per factors (TG-104).
 * Tots els instants són ISO 8601 en UTC; angles en graus.
 */

/** Posició d'un astre vist des d'un lloc: alçada sobre l'horitzó i azimut. */
export type PosicioAstre = {
  /**
   * Alçada geomètrica del centre de l'astre sobre l'horitzó, de −90 a 90 graus (negativa: sota
   * l'horitzó). Sense refracció atmosfèrica: és la que fan servir les definicions dels crepuscles.
   */
  alcada: number;
  /** Azimut de 0 a 360 graus: 0 = nord, 90 = est, 180 = sud, 270 = oest. */
  azimut: number;
};

/**
 * Franja de llum del cel segons l'alçada geomètrica del Sol (definicions estàndard):
 * `dia` (Sol sobre l'horitzó, alçada > −0,833°), `civil` (fins a −6°), `nautic` (fins a −12°),
 * `astronomic` (fins a −18°) i `nit` (Sol per sota de −18°: foscor astronòmica completa).
 */
export type FranjaCrepuscle = 'dia' | 'civil' | 'nautic' | 'astronomic' | 'nit';

/**
 * Nom de la fase lunar a partir de l'angle de fase, en vuit trams de 45° centrats a 0° (`nova`),
 * 90° (`quart_creixent`), 180° (`plena`) i 270° (`quart_minvant`).
 */
export type FaseLunar =
  | 'nova'
  | 'creixent'
  | 'quart_creixent'
  | 'gibosa_creixent'
  | 'plena'
  | 'gibosa_minvant'
  | 'quart_minvant'
  | 'minvant';

/** Estat de la Lluna en un instant: on és i quanta llum fa. */
export type EstatLluna = PosicioAstre & {
  /** Fracció del disc il·luminada, de 0 (nova) a 1 (plena). */
  fraccioIlluminada: number;
  /**
   * Angle de fase: diferència de longitud eclíptica Lluna − Sol, de 0 a 360 graus
   * (0 nova, 90 quart creixent, 180 plena, 270 quart minvant).
   */
  angleFase: number;
  fase: FaseLunar;
};

/** Efemèrides d'un instant en un punt: el que la fórmula de l'índex necessita de cada hora. */
export type EfemeridesHora = {
  /** Instant del càlcul, ISO 8601 en UTC; coincideix amb `PrevisioMeteoHora.hora` quan s'alineen. */
  hora: string;
  sol: PosicioAstre;
  crepuscle: FranjaCrepuscle;
  lluna: EstatLluna;
};

/**
 * Esdeveniments del Sol i de la Lluna d'una nit en un punt, de la posta de sol a la sortida
 * següent. Un crepuscle és `null` quan el Sol no arriba a l'alçada corresponent (no passa a
 * Catalunya, però sí a latituds altes a l'estiu); la sortida o la posta de la Lluna són `null`
 * quan no es produeixen dins de la nit.
 */
export type NitAstronomica = {
  /** Dia civil (`YYYY-MM-DD`, hora local del punt) en què comença la nit, al vespre. */
  data: string;
  postaSol: string;
  /** El Sol arriba a −6°: a partir d'aquí calen llums per llegir. */
  fiCrepuscleCivil: string | null;
  /** El Sol arriba a −12°: l'horitzó marí deixa de veure's. */
  fiCrepuscleNautic: string | null;
  /** El Sol arriba a −18°: comença la foscor astronòmica. */
  fiCrepuscleAstronomic: string | null;
  /** El Sol torna a −18°: s'acaba la foscor astronòmica. */
  iniciCrepuscleAstronomic: string | null;
  iniciCrepuscleNautic: string | null;
  iniciCrepuscleCivil: string | null;
  sortidaSol: string;
  sortidaLluna: string | null;
  postaLluna: string | null;
  /** Fase de la Lluna a mitja nit (punt mitjà entre la posta i la sortida del Sol). */
  lluna: Pick<EstatLluna, 'fraccioIlluminada' | 'angleFase' | 'fase'>;
};
