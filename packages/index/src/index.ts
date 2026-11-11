// Les peces de l'índex de visibilitat que comparteixen el worker (punts del catàleg, cada hora) i
// l'API (qualsevol ubicació, al moment): ADR-0031.
export {
  ALCADA_CREPUSCLE,
  ALCADA_SOL_HORITZO,
  efemeridesHora,
  efemeridesHores,
  estatLluna,
  faseLunar,
  franjaCrepuscle,
  nitAstronomica,
  nomFaseLunar,
  posicioSol,
  type LlocObservacio,
} from './astronomia';
export {
  FORMULA_V1,
  calculaIndex,
  calculaIndexHores,
  factorFoscor,
  factorLluna,
  factorNuvols,
  factorSol,
  franjaDe,
  type EntradaIndex,
} from './formula';
export {
  DIES_PREVISIO_PER_DEFECTE,
  LLOCS_PER_PETICIO_PER_DEFECTE,
  OpenMeteoError,
  TIMEOUT_MS_PER_DEFECTE,
  UNITATS,
  UNITATS_ESPERADES,
  VARIABLES_HORARIES,
  createOpenMeteoClient,
  toHores,
  type Coordenades,
  type OpenMeteoClient,
  type OpenMeteoClientOptions,
} from './openMeteo';
