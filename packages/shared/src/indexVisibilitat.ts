/**
 * Franja de color de l'índex. Els valors són els noms dels tokens del design system
 * (`docs/design-system.md`): `tap` (cel tapat), `jus` (regular), `ras` (cel ras).
 * Llindars de la fórmula v1 (ADR-0018): 0–39 `tap`, 40–69 `jus`, 70–100 `ras`.
 */
export type FranjaIndex = 'tap' | 'jus' | 'ras';

/** Índex de visibilitat d'un lloc en una hora (ADR-0004). */
export type IndexVisibilitat = {
  /** Enter de 0 a 100. */
  valor: number;
  franja: FranjaIndex;
};

/**
 * Els factors de l'índex, cadascun de 0 a 1: el desglossament que mostra la fitxa del punt (HU04).
 * `nuvols` i `sol` multipliquen; `foscor` i `lluna` es ponderen (0,6 i 0,4; ADR-0018); a la v2,
 * `humitat` multiplica el resultat (ADR-0038).
 */
export type FactorsIndex = {
  /** 1 amb el cel ras; 0 tapat o si plou. */
  nuvols: number;
  /** 1 de nit o en el crepuscle astronòmic, 0,5 en el nàutic, 0 en el civil o de dia. */
  sol: number;
  /** Foscor del cel segons la contaminació lumínica: 1 com més fosc. */
  foscor: number;
  /**
   * 1 sense Lluna; baixa com més il·luminada i alta és. A la v2, si el relleu del punt la tapa,
   * resta la meitat (ADR-0038).
   */
  lluna: number;
  /**
   * Índex v2 (ADR-0038): 1 fins al 85 % d'humitat relativa i 0,7 al 100 % (calitja i rosada).
   * Absent a les files de la v1.
   */
  humitat?: number;
};

/** L'índex d'un lloc en una hora, amb els factors que l'expliquen. */
export type IndexHora = IndexVisibilitat & {
  /** Inici de l'hora, ISO 8601 en UTC; el mateix instant que la previsió i les efemèrides. */
  hora: string;
  factors: FactorsIndex;
  /** La foscor és provisional: el punt no té SQM del mapa de contaminació lumínica (ADR-0020). */
  foscorEstimada: boolean;
  /**
   * La humitat s'ha corregit amb el biaix de l'estació de la XEMA més propera (índex v2, ADR-0038):
   * cal citar el Servei Meteorològic de Catalunya. Absent o `false`: la humitat d'Open-Meteo.
   */
  humitatCorregida?: boolean;
  /**
   * Versió de la fórmula: 1 (ADR-0018) o 2 (ADR-0038). Absent = 1. L'API sempre l'envia; és
   * opcional perquè les files i les respostes d'abans de la v2 continuïn sent vàlides.
   */
  versio?: number;
};
